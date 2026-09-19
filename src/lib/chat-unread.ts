/** Contador de mensajes de chat no leídos (por dispositivo). */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pin-gate";

const KEY = "rmordie_chat_seen_v1";
const EVENT = "rmordie:chat-seen";

export function getChatSeenAt(): string {
  if (typeof localStorage === "undefined") return new Date(0).toISOString();
  return localStorage.getItem(KEY) ?? new Date(0).toISOString();
}

export function markChatSeen() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, new Date().toISOString());
  window.dispatchEvent(new Event(EVENT));
}

export function useChatUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const uid = getCurrentUserId();

    async function refresh() {
      if (!uid) return;
      const { count: c } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", getChatSeenAt())
        .neq("user_id", uid);
      if (!cancelled) setCount(c ?? 0);
    }

    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("focus", refresh);

    const channel = supabase
      .channel("chat_unread_badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("focus", refresh);
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}
