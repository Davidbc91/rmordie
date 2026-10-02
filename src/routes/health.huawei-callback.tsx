import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type CallbackSearch = { code?: string; state?: string; error?: string; error_description?: string };

export const Route = createFileRoute("/health/huawei-callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description: typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({ meta: [{ title: "Conectando Huawei Health — RM OR DIE" }] }),
  component: HuaweiCallbackPage,
});

function HuaweiCallbackPage() {
  const search = Route.useSearch();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Completando conexión…");

  useEffect(() => {
    let cancelled = false;
    async function finish() {
      if (search.error) {
        if (!cancelled) {
          setState("error");
          setMessage(search.error_description ?? "Huawei ha cancelado o rechazado la autorización.");
        }
        return;
      }
      if (!search.code || !search.state) {
        if (!cancelled) {
          setState("error");
          setMessage("Faltan parámetros de autorización.");
        }
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("huawei-health", {
          body: { action: "callback", code: search.code, state: search.state },
        });
        if (error || data?.error) throw new Error(error?.message ?? data?.error ?? "No se ha podido completar la conexión.");
        if (!cancelled) {
          setState("success");
          setMessage("Huawei Health está conectado. Ya podemos preparar la sincronización de datos.");
        }
      } catch (error: any) {
        if (!cancelled) {
          setState("error");
          setMessage(error?.message ?? "No se ha podido completar la conexión.");
        }
      }
    }
    finish();
    return () => { cancelled = true; };
  }, [search.code, search.state, search.error, search.error_description]);

  return (
    <AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <section className="cinematic-card-strong w-full max-w-md rounded-[24px] p-6 text-center">
          {state === "loading" && <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold" />}
          {state === "success" && <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />}
          {state === "error" && <XCircle className="mx-auto h-10 w-10 text-destructive" />}
          <p className="cinematic-label mt-5">HUAWEI HEALTH</p>
          <h1 className="mt-2 text-xl font-semibold">{state === "success" ? "Conexión completada" : state === "error" ? "No se pudo conectar" : "Conectando"}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
          {state !== "loading" && (
            <Link to="/health" className="mt-6 inline-flex rounded-xl gold-gradient px-5 py-2.5 text-sm font-semibold" style={{ color: "var(--gold-foreground)" }}>
              Volver a Salud
            </Link>
          )}
        </section>
      </div>
    </AppShell>
  );
}
