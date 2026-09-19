import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/pin-gate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, MessageCircle, Bell, BellOff } from "lucide-react";
import { markChatSeen } from "@/lib/chat-unread";
import {
  disablePush,
  enablePush,
  iosNeedsInstall,
  isPushActive,
  pushSupported,
} from "@/lib/push";
import { notifyChatMessage } from "@/lib/push.functions";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — RM OR DIE" },
      { name: "description", content: "Chat común para todos los miembros del box." },
      { property: "og:title", content: "Chat — RM OR DIE" },
      { property: "og:description", content: "Habla con el resto del box en tiempo real." },
    ],
  }),
  component: ChatPage,
});

type ChatMessage = {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

function ChatPage() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const notify = useServerFn(notifyChatMessage);

  useEffect(() => {
    isPushActive().then(setPushOn);
  }, []);

  const togglePush = useCallback(async () => {
    if (!uid || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Avisos desactivados en este dispositivo");
        return;
      }
      const res = await enablePush(uid);
      if (res.ok) {
        setPushOn(true);
        toast.success("Avisos activados en este dispositivo");
      } else {
        toast.error(res.message);
      }
    } finally {
      setPushBusy(false);
    }
  }, [uid, pushOn, pushBusy]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chat_messages"],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("chat_messages_stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          qc.setQueryData<ChatMessage[]>(["chat_messages"], (prev = []) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const old = payload.old as { id: string };
          qc.setQueryData<ChatMessage[]>(["chat_messages"], (prev = []) =>
            prev.filter((m) => m.id !== old.id),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !uid || sending) return;
    if (content.length > 500) {
      toast.error("Máximo 500 caracteres");
      return;
    }
    setSending(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", uid)
        .single();
      const user_name = (profile as { name?: string } | null)?.name ?? "Malito";
      const { error } = await supabase
        .from("chat_messages")
        .insert({ user_id: uid, user_name, content });
      if (error) throw error;
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar este mensaje?")) return;
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .eq("id", id)
      .eq("user_id", uid ?? "");
    if (error) toast.error(error.message);
  }

  return (
    <AppShell>
      <div className="flex flex-col" style={{ height: "calc(100vh - 10rem)" }}>
        <header className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" style={{ color: "var(--gold)" }} />
          <div>
            <h1 className="text-xl font-bold">Chat del box</h1>
            <p className="text-xs text-muted-foreground">
              Conversación en tiempo real con todos los RM OR DIE.
            </p>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-surface/40 p-3"
        >
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground">Cargando…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sé el primero en escribir 👊
            </p>
          ) : (
            messages.map((m, i) => {
              const mine = m.user_id === uid;
              const prev = messages[i - 1];
              const showName = !prev || prev.user_id !== m.user_id;
              const time = new Date(m.created_at).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
                >
                  {showName && !mine && (
                    <span className="mb-0.5 px-2 text-[11px] font-semibold gold-text">
                      {m.user_name}
                    </span>
                  )}
                  <button
                    onClick={mine ? () => handleDelete(m.id) : undefined}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm text-left break-words ${
                      mine
                        ? "gold-gradient"
                        : "border border-border bg-background/60 text-foreground"
                    }`}
                    style={mine ? { color: "var(--gold-foreground)" } : undefined}
                    title={mine ? "Toca para borrar" : undefined}
                  >
                    <span className="whitespace-pre-wrap">{m.content}</span>
                    <span
                      className={`ml-2 align-baseline text-[10px] tabular ${
                        mine ? "opacity-70" : "text-muted-foreground"
                      }`}
                    >
                      {time}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Escribe un mensaje…"
            className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[var(--gold)]"
            style={{ maxHeight: 120 }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="flex h-12 w-12 items-center justify-center rounded-full gold-gradient disabled:opacity-40"
            style={{ color: "var(--gold-foreground)" }}
            aria-label="Enviar"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}
