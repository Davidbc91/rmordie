// Conexión con Strava: pulso, calorías y duración de cada entreno del reloj.
// Acciones:
//   start      (con sesión)  → URL para autorizar en Strava
//   callback   (sin sesión)  → canjea el código usando el «state» de un solo uso
//   status     (con sesión)  → si está conectado, nombre y última sincronización
//   sync       (con sesión)  → trae las actividades nuevas a training_activities
//   disconnect (con sesión)  → revoca el acceso y borra los tokens
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("STRAVA_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("STRAVA_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("STRAVA_REDIRECT_URI") ?? "https://rmordie.lovable.app/strava-callback";
const TOKEN_KEY = Deno.env.get("STRAVA_TOKEN_KEY") ?? "";
const PROVIDER = "strava";
const API = "https://www.strava.com/api/v3";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function requireConfig() {
  if (!CLIENT_ID || !CLIENT_SECRET || !TOKEN_KEY) {
    throw new Error("Strava todavía no está configurado en el servidor (faltan STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET o STRAVA_TOKEN_KEY).");
  }
}

/** Perfil de la sesión: profiles.auth_user_id = usuario de Supabase Auth. */
async function profileFromRequest(req: Request): Promise<string> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Inicia sesión para conectar Strava.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sesión no válida. Vuelve a entrar.");
  const { data: profile } = await admin.from("profiles").select("id").eq("auth_user_id", data.user.id).maybeSingle();
  if (!profile?.id) throw new HttpError(403, "Tu sesión no tiene un perfil vinculado.");
  return profile.id as string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---- Cifrado de tokens (AES-GCM) ----
async function key() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(TOKEN_KEY));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(value)));
  const all = new Uint8Array(iv.length + enc.length);
  all.set(iv);
  all.set(enc, iv.length);
  return btoa(String.fromCharCode(...all));
}
async function decrypt(value: string) {
  const all = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: all.slice(0, 12) }, await key(), all.slice(12));
  return new TextDecoder().decode(plain);
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new HttpError(502, data?.message ?? "Strava no ha devuelto un token válido.");
  return data as { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number; firstname?: string; lastname?: string } };
}

async function saveTokens(profileId: string, t: { access_token: string; refresh_token: string; expires_at: number }, extra: Record<string, unknown> = {}) {
  const { error } = await admin.from("health_integrations").upsert(
    {
      profile_id: profileId,
      provider: PROVIDER,
      status: "connected",
      access_token_ciphertext: await encrypt(t.access_token),
      refresh_token_ciphertext: await encrypt(t.refresh_token),
      token_expires_at: new Date(t.expires_at * 1000).toISOString(),
      error_message: null,
      ...extra,
    },
    { onConflict: "profile_id,provider" },
  );
  if (error) throw error;
}

/** Token de acceso válido (lo renueva si caduca en menos de 5 minutos). */
async function accessToken(profileId: string) {
  const { data: row } = await admin
    .from("health_integrations")
    .select("access_token_ciphertext,refresh_token_ciphertext,token_expires_at,status")
    .eq("profile_id", profileId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  if (!row || row.status !== "connected" || !row.refresh_token_ciphertext) throw new HttpError(409, "Strava no está conectado.");
  const expires = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (expires - Date.now() > 5 * 60_000) return decrypt(row.access_token_ciphertext);
  const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: await decrypt(row.refresh_token_ciphertext) });
  await saveTokens(profileId, fresh);
  return fresh.access_token;
}

async function stravaGet(token: string, path: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) throw new HttpError(429, "Strava pide esperar un poco antes de sincronizar otra vez.");
  if (res.status === 401) throw new HttpError(401, "Strava ha retirado el permiso. Vuelve a conectarlo.");
  if (!res.ok) throw new HttpError(502, `Strava respondió ${res.status}.`);
  return res.json();
}

async function sync(profileId: string) {
  const token = await accessToken(profileId);
  const { data: integ } = await admin
    .from("health_integrations")
    .select("last_sync_at")
    .eq("profile_id", profileId)
    .eq("provider", PROVIDER)
    .maybeSingle();
  // Primera vez: últimos 60 días. Después: desde la última sincronización (con 2 días de margen).
  const since = integ?.last_sync_at
    ? new Date(integ.last_sync_at).getTime() - 2 * 86400_000
    : Date.now() - 60 * 86400_000;
  const after = Math.floor(since / 1000);

  const list: any[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await stravaGet(token, `/athlete/activities?after=${after}&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    list.push(...batch);
    if (batch.length < 100) break;
  }

  // Calorías: solo vienen en el detalle de cada actividad. Se piden para las
  // que aún no las tienen (máximo 40 por sincronización por el límite de Strava).
  const ids = list.map((a) => String(a.id));
  const { data: existing } = ids.length
    ? await admin.from("training_activities").select("external_id,calories").eq("user_id", profileId).eq("source", PROVIDER).in("external_id", ids)
    : { data: [] as { external_id: string; calories: number | null }[] };
  const known = new Map((existing ?? []).map((r) => [r.external_id, r.calories]));

  let detailBudget = 40;
  const rows = [];
  for (const a of list) {
    let calories: number | null = known.get(String(a.id)) ?? null;
    if (calories == null && detailBudget > 0) {
      detailBudget--;
      try {
        const detail = await stravaGet(token, `/activities/${a.id}`);
        calories = typeof detail.calories === "number" && detail.calories > 0 ? detail.calories : null;
      } catch (e) {
        if (e instanceof HttpError && e.status === 429) detailBudget = 0;
      }
    }
    rows.push({
      user_id: profileId,
      source: PROVIDER,
      external_id: String(a.id),
      name: a.name ?? null,
      sport_type: a.sport_type ?? a.type ?? null,
      start_at: a.start_date,
      local_date: String(a.start_date_local ?? a.start_date).slice(0, 10),
      duration_s: a.moving_time ?? a.elapsed_time ?? null,
      distance_m: a.distance ?? null,
      avg_hr: a.average_heartrate ?? null,
      max_hr: a.max_heartrate ?? null,
      calories,
    });
  }
  if (rows.length) {
    const { error } = await admin.from("training_activities").upsert(rows, { onConflict: "user_id,source,external_id" });
    if (error) throw error;
  }
  await admin
    .from("health_integrations")
    .update({ last_sync_at: new Date().toISOString(), error_message: null })
    .eq("profile_id", profileId)
    .eq("provider", PROVIDER);
  return { imported: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "start") {
      requireConfig();
      const profileId = await profileFromRequest(req);
      const state = crypto.randomUUID();
      const { error } = await admin.from("health_oauth_states").insert({
        state,
        profile_id: profileId,
        provider: PROVIDER,
        expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      });
      if (error) throw error;
      const url = new URL("https://www.strava.com/oauth/mobile/authorize");
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("approval_prompt", "auto");
      url.searchParams.set("scope", "read,activity:read_all");
      url.searchParams.set("state", state);
      return json({ url: url.toString() });
    }

    if (action === "callback") {
      requireConfig();
      const code = String(body.code ?? "");
      const state = String(body.state ?? "");
      const scope = String(body.scope ?? "");
      if (!code || !state) return json({ error: "Falta el código de Strava." }, 400);
      const { data: st } = await admin
        .from("health_oauth_states")
        .select("profile_id,expires_at")
        .eq("state", state)
        .eq("provider", PROVIDER)
        .maybeSingle();
      // El «state» es de un solo uso
      await admin.from("health_oauth_states").delete().eq("state", state);
      if (!st || new Date(st.expires_at).getTime() < Date.now()) {
        return json({ error: "El enlace ha caducado. Vuelve a pulsar «Conectar Strava» en la app." }, 400);
      }
      if (!scope.includes("activity:read")) {
        return json({ error: "Hace falta permitir que RM OR DIE vea tus actividades." }, 400);
      }
      const t = await tokenRequest({ grant_type: "authorization_code", code });
      const name = [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(" ");
      await saveTokens(st.profile_id, t, {
        provider_user_id: t.athlete?.id ? String(t.athlete.id) : null,
        scopes: scope.split(","),
        metadata: { athlete_name: name || null },
      });
      let imported = 0;
      try {
        imported = (await sync(st.profile_id)).imported;
      } catch { /* la primera sincronización puede repetirse desde la app */ }
      return json({ ok: true, athlete: name || null, imported });
    }

    if (action === "status") {
      const profileId = await profileFromRequest(req);
      const { data: row } = await admin
        .from("health_integrations")
        .select("status,last_sync_at,metadata,error_message")
        .eq("profile_id", profileId)
        .eq("provider", PROVIDER)
        .maybeSingle();
      return json({
        configured: !!(CLIENT_ID && CLIENT_SECRET && TOKEN_KEY),
        connected: row?.status === "connected",
        athlete: (row?.metadata as any)?.athlete_name ?? null,
        lastSyncAt: row?.last_sync_at ?? null,
        error: row?.error_message ?? null,
      });
    }

    if (action === "sync") {
      requireConfig();
      const profileId = await profileFromRequest(req);
      try {
        return json(await sync(profileId));
      } catch (e) {
        if (e instanceof HttpError && e.status === 401) {
          await admin.from("health_integrations").update({ status: "error", error_message: e.message }).eq("profile_id", profileId).eq("provider", PROVIDER);
        }
        throw e;
      }
    }

    if (action === "disconnect") {
      const profileId = await profileFromRequest(req);
      try {
        const token = await accessToken(profileId);
        await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      } catch { /* aunque falle en Strava, se borran los tokens aquí */ }
      await admin.from("health_integrations").delete().eq("profile_id", profileId).eq("provider", PROVIDER);
      return json({ ok: true });
    }

    return json({ error: "Acción no válida." }, 400);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : "Error inesperado";
    return json({ error: message }, status);
  }
});
