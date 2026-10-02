import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "movement-videos";

type Body = {
  action: "check" | "verify" | "create_upload" | "save_upload" | "save_youtube" | "delete";
  profile_id?: string;
  pin_hash?: string;
  movement_id?: string;
  title?: string;
  youtube_url?: string;
  storage_path?: string;
  extension?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default as string;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  throw new Error("Supabase secret key no disponible");
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  secretKey(),
);

async function isAdmin(profileId: string, pinHash?: string) {
  if (!profileId || !pinHash) return false;

  // The app uses profile + PIN rather than Supabase Auth.
  // Verify the stored SHA-256 hash directly with the service role.
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, pin_hash")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !profile) return false;
  if (profile.name?.trim().toLowerCase() !== "bc") return false;

  return profile.pin_hash === pinHash;
}

function validMovementId(id?: string) {
  return !!id && /^move-\d{3}$/.test(id);
}

function validYoutube(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as Body;

    if (body.action === "check") {
      if (!body.profile_id) return json({ isAdmin: false });
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, name")
        .eq("id", body.profile_id)
        .maybeSingle();
      return json({ isAdmin: data?.name?.trim().toLowerCase() === "bc" });
    }

    if (body.action === "verify") {
      const authorized = await isAdmin(body.profile_id ?? "", body.pin_hash);
      return authorized ? json({ ok: true }) : json({ error: "PIN incorrecto" }, 403);
    }

    if (!(await isAdmin(body.profile_id ?? "", body.pin_hash))) {
      return json({ error: "No autorizado" }, 403);
    }

    if (!validMovementId(body.movement_id)) {
      return json({ error: "Movimiento no válido" }, 400);
    }

    if (body.action === "create_upload") {
      const ext = (body.extension ?? "").toLowerCase().replace(/^\./, "");
      if (!["mp4", "webm", "mov"].includes(ext)) {
        return json({ error: "Formato no permitido" }, 400);
      }

      const path = `${body.movement_id}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(path, { upsert: false });

      if (error) throw error;
      return json({ path, token: data.token });
    }

    if (body.action === "save_upload") {
      if (!body.storage_path || !body.title) return json({ error: "Faltan datos" }, 400);

      const { data: previous } = await supabaseAdmin
        .from("movement_videos")
        .select("storage_path")
        .eq("movement_id", body.movement_id!)
        .maybeSingle();

      const { error } = await supabaseAdmin.from("movement_videos").upsert({
        movement_id: body.movement_id,
        source_type: "upload",
        youtube_url: null,
        storage_path: body.storage_path,
        title: body.title,
        updated_at: new Date().toISOString(),
      }, { onConflict: "movement_id" });

      if (error) throw error;

      if (previous?.storage_path && previous.storage_path !== body.storage_path) {
        await supabaseAdmin.storage.from(BUCKET).remove([previous.storage_path]);
      }

      return json({ ok: true });
    }

    if (body.action === "save_youtube") {
      if (!body.youtube_url || !validYoutube(body.youtube_url) || !body.title) {
        return json({ error: "URL de YouTube no válida" }, 400);
      }

      const { data: previous } = await supabaseAdmin
        .from("movement_videos")
        .select("storage_path")
        .eq("movement_id", body.movement_id!)
        .maybeSingle();

      const { error } = await supabaseAdmin.from("movement_videos").upsert({
        movement_id: body.movement_id,
        source_type: "youtube",
        youtube_url: body.youtube_url,
        storage_path: null,
        title: body.title,
        updated_at: new Date().toISOString(),
      }, { onConflict: "movement_id" });

      if (error) throw error;

      if (previous?.storage_path) {
        await supabaseAdmin.storage.from(BUCKET).remove([previous.storage_path]);
      }

      return json({ ok: true });
    }

    if (body.action === "review") {
      if (!body.profile_id || !body.pin_hash) return json({ error: "No autorizado" }, 401);
      if (!(await isAdmin(body.profile_id, body.pin_hash))) return json({ error: "No autorizado" }, 403);
      const movementId = String(body.movement_id ?? "");
      const status = String(body.status ?? "");
      if (!/^move-\d{3}$/.test(movementId)) return json({ error: "Movimiento inválido" }, 400);
      if (!["pending", "verified", "needs_review"].includes(status)) {
        return json({ error: "Estado de revisión inválido" }, 400);
      }
      const { error } = await supabaseAdmin
        .from("movement_video_reviews")
        .upsert({
          movement_id: movementId,
          status,
          reviewed_by: body.profile_id,
          reviewed_at: new Date().toISOString(),
          notes: body.notes ? String(body.notes).slice(0, 500) : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "movement_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (body.action === "delete") {
      const { data: previous } = await supabaseAdmin
        .from("movement_videos")
        .select("storage_path")
        .eq("movement_id", body.movement_id!)
        .maybeSingle();

      const { error } = await supabaseAdmin
        .from("movement_videos")
        .delete()
        .eq("movement_id", body.movement_id!);

      if (error) throw error;

      if (previous?.storage_path) {
        await supabaseAdmin.storage.from(BUCKET).remove([previous.storage_path]);
      }

      return json({ ok: true });
    }

    return json({ error: "Acción no soportada" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
