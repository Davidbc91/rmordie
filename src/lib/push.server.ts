/**
 * Lógica de envío de notificaciones push. SOLO servidor.
 * Este archivo nunca debe importarse desde componentes ni a nivel de módulo de
 * un `.functions.ts`: se carga dinámicamente dentro del handler.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildPushPayload } from "@block65/webcrypto-web-push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  skipIfVisible?: string;
};

/**
 * Cliente del servidor con la clave de servicio: con el aislamiento por
 * usuario activado, las suscripciones push y el chat no son legibles con la
 * clave pública sin sesión.
 */
export function serverClient() {
  return supabaseAdmin;
}

/**
 * Envía `payload` a los dispositivos registrados.
 * - `excludeUserId`: a todos menos a ese perfil (chat).
 * - `onlyUserId`: solo a los dispositivos de ese perfil (avisos personales).
 */
export async function deliver(opts: {
  payload: PushPayload;
  excludeUserId?: string | null;
  onlyUserId?: string | null;
}): Promise<{ sent: number; removed: number }> {
  const sb = serverClient();
  const vapid = {
    subject: process.env["VAPID_SUBJECT"] || "mailto:notificaciones@rmordie.lovable.app",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, removed: 0 };

  let query = sb.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (opts.excludeUserId) query = query.neq("user_id", opts.excludeUserId);
  if (opts.onlyUserId) query = query.eq("user_id", opts.onlyUserId);
  const { data: subs, error } = await query;
  if (error || !subs?.length) return { sent: 0, removed: 0 };

  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: null,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        const req = await buildPushPayload(
          { data: opts.payload, options: { ttl: 3600, urgency: "high" } },
          subscription,
          { subject: vapid.subject, publicKey: vapid.publicKey!, privateKey: vapid.privateKey! },
        );
        const res = await fetch(row.endpoint, {
          method: req.method,
          headers: req.headers,
          body: req.body as unknown as BodyInit,
        });
        if (res.status === 404 || res.status === 410) stale.push(row.endpoint);
        else if (res.ok) sent += 1;
      } catch {
        /* un dispositivo fallido no debe romper el envío */
      }
    }),
  );

  if (stale.length) {
    await sb.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return { sent, removed: stale.length };
}

/** Lee el mensaje guardado y avisa al resto de dispositivos. */
export async function notifyChatMessageImpl(messageId: string) {
  const sb = serverClient();
  const { data: msg } = await sb
    .from("chat_messages")
    .select("id, user_id, user_name, content, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return { sent: 0, removed: 0 };

  // Solo notificamos mensajes recientes (evita reenvíos de mensajes antiguos).
  if (Date.now() - new Date(msg.created_at).getTime() > 5 * 60 * 1000) {
    return { sent: 0, removed: 0 };
  }

  const preview = msg.content.length > 120 ? `${msg.content.slice(0, 117)}…` : msg.content;
  return deliver({
    excludeUserId: msg.user_id,
    payload: {
      title: `RM OR DIE · ${msg.user_name}`,
      body: preview,
      url: "/chat",
      tag: "chat",
      skipIfVisible: "/chat",
    },
  });
}
