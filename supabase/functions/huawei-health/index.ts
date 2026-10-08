import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUAWEI_CLIENT_ID = Deno.env.get("HUAWEI_CLIENT_ID") ?? "";
const HUAWEI_CLIENT_SECRET = Deno.env.get("HUAWEI_CLIENT_SECRET") ?? "";
const HUAWEI_REDIRECT_URI = Deno.env.get("HUAWEI_REDIRECT_URI") ?? "";
const TOKEN_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/token";
const AUTH_URL = "https://oauth-login.cloud.huawei.com/oauth2/v3/authorize";
const CRYPTO_SECRET = Deno.env.get("HUAWEI_TOKEN_ENCRYPTION_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function requireConfig() {
  if (!HUAWEI_CLIENT_ID || !HUAWEI_CLIENT_SECRET || !HUAWEI_REDIRECT_URI || !CRYPTO_SECRET) {
    throw new Error("Huawei Health todavía no está configurado en el servidor.");
  }
}

function requirePinHash(pinHash: unknown) {
  if (typeof pinHash !== "string" || !/^[a-f0-9]{64}$/i.test(pinHash)) {
    throw new Error("PIN no válido.");
  }
}

/** Comprueba el PIN con verify_profile_pin, que aplica el límite de intentos. */
async function isValidProfilePin(profileId: string, pinHash: string) {
  requirePinHash(pinHash);
  const { data, error } = await supabase.rpc("verify_profile_pin", {
    _profile_id: profileId,
    _pin_hash: pinHash,
  });
  // Perfil bloqueado por demasiados intentos: el mensaje explica cuánto falta.
  if (error) throw new Error(error.message);
  return data === true;
}

async function deriveKey() {
  const raw = new TextEncoder().encode(CRYPTO_SECRET);
  const digest = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string) {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + bytes.length);
  combined.set(iv);
  combined.set(bytes, iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: HUAWEI_CLIENT_ID,
    client_secret: HUAWEI_CLIENT_SECRET,
    redirect_uri: HUAWEI_REDIRECT_URI,
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data?.error_description ?? "Huawei no ha devuelto un token válido.");
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "authorize") {
      requireConfig();
      const profileId = String(body.profileId ?? "");
      const pinHash = String(body.pinHash ?? "");
      if (!profileId || !(await isValidProfilePin(profileId, pinHash))) {
        return json({ error: "PIN incorrecto." }, 401);
      }

      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
      const { error } = await supabase.from("health_oauth_states").insert({
        state,
        profile_id: profileId,
        provider: "huawei_health",
        expires_at: expiresAt,
      });
      if (error) throw error;

      const scopes = [
        "openid",
        "https://www.huawei.com/healthkit/activityrecord.read",
        "https://www.huawei.com/healthkit/activity.read",
        "https://www.huawei.com/healthkit/heartrate.read",
      ];

      const url = new URL(AUTH_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("access_type", "offline");
      url.searchParams.set("client_id", HUAWEI_CLIENT_ID);
      url.searchParams.set("redirect_uri", HUAWEI_REDIRECT_URI);
      url.searchParams.set("state", state);
      url.searchParams.set("scope", scopes.join(" "));

      return json({ authorizationUrl: url.toString() });
    }

    if (action === "callback") {
      requireConfig();
      const code = String(body.code ?? "");
      const state = String(body.state ?? "");
      if (!code || !state) return json({ error: "Falta code o state." }, 400);

      const { data: oauthState, error: stateError } = await supabase
        .from("health_oauth_states")
        .select("state,profile_id,expires_at")
        .eq("state", state)
        .eq("provider", "huawei_health")
        .maybeSingle();

      if (stateError || !oauthState || new Date(oauthState.expires_at).getTime() < Date.now()) {
        return json({ error: "Estado OAuth inválido o caducado." }, 400);
      }

      const token = await exchangeCode(code);
      const accessCipher = await encrypt(String(token.access_token));
      const refreshCipher = token.refresh_token ? await encrypt(String(token.refresh_token)) : null;
      const expiresAt = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString();

      const { error: upsertError } = await supabase.from("health_integrations").upsert({
        profile_id: oauthState.profile_id,
        provider: "huawei_health",
        status: "connected",
        last_sync_at: null,
        scopes: String(token.scope ?? "").split(" ").filter(Boolean),
        provider_user_id: token.open_id ?? null,
        access_token_ciphertext: accessCipher,
        refresh_token_ciphertext: refreshCipher,
        token_expires_at: expiresAt,
        error_message: null,
        metadata: { connected_via: "oauth" },
      }, { onConflict: "profile_id,provider" });

      if (upsertError) throw upsertError;

      await supabase.from("health_oauth_states").delete().eq("state", state);
      return json({ connected: true, profileId: oauthState.profile_id });
    }

    if (action === "status") {
      const profileId = String(body.profileId ?? "");
      const pinHash = String(body.pinHash ?? "");
      if (!profileId || !(await isValidProfilePin(profileId, pinHash))) {
        return json({ error: "PIN incorrecto." }, 401);
      }
      const { data } = await supabase.from("health_integrations")
        .select("provider,status,last_sync_at,scopes,token_expires_at,error_message")
        .eq("profile_id", profileId)
        .eq("provider", "huawei_health")
        .maybeSingle();
      return json({ integration: data ?? null });
    }

    return json({ error: "Acción no soportada." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error interno." }, 500);
  }
});
