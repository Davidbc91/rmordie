import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Activity, CheckCircle2, ChevronRight, HeartPulse, LockKeyhole, Watch } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startHuaweiHealthAuthorization, getHuaweiHealthStatus } from "@/lib/health-integrations";

export const Route = createFileRoute("/health")({
  head: () => ({
    meta: [
      { title: "Salud e integraciones — RM OR DIE" },
      { name: "description", content: "Conecta tus datos de salud y actividad con RM OR DIE." },
    ],
  }),
  component: HealthPage,
});

const providers = [
  {
    id: "huawei_health",
    name: "Huawei Health",
    subtitle: "Sueño, frecuencia cardíaca, entrenamientos y actividad",
    icon: Watch,
    primary: true,
  },
  {
    id: "apple_health",
    name: "Apple Health",
    subtitle: "Preparado para una futura integración",
    icon: HeartPulse,
    primary: false,
  },
  {
    id: "health_connect",
    name: "Health Connect",
    subtitle: "Preparado para Android",
    icon: Activity,
    primary: false,
  },
];

function HealthPage() {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");

  async function connectHuawei() {
    try {
      if (pin.length < 4) return toast.error("Introduce tu PIN para autorizar la conexión.");
      const result = await startHuaweiHealthAuthorization(pin);
      window.location.href = result.authorizationUrl;
    } catch (error: any) {
      toast.error(error?.message ?? "No se ha podido iniciar la conexión.");
    }
  }

  async function checkHuawei() {
    try {
      if (pin.length < 4) return toast.error("Introduce tu PIN.");
      setChecking(true);
      const result = await getHuaweiHealthStatus(pin);
      setStatus(result.integration?.status === "connected" ? "connected" : "disconnected");
    } catch (error: any) {
      toast.error(error?.message ?? "No se ha podido comprobar la conexión.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <AppShell>
      <header className="rise rise-1">
        <div className="flex items-center gap-2">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-gold" />
          <p className="cinematic-label">HEALTH DATA</p>
        </div>
        <h1 className="cinematic-title mt-5">Salud<span className="gold-text">.</span></h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Conecta tus fuentes de salud para que Training Intelligence pueda cruzar recuperación, actividad y entrenamiento.
        </p>
      </header>

      <section className="mt-6 cinematic-card-strong rounded-[24px] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div>
            <p className="cinematic-label">PRIVACY FIRST</p>
            <h2 className="mt-1 text-lg font-semibold">Tú decides qué datos compartes</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              RM OR DIE solo debe solicitar los datos necesarios para el análisis. Las conexiones se autorizarán desde el proveedor y podremos desconectarlas cuando quieras.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-4 space-y-3">
        {providers.map((provider) => {
          const Icon = provider.icon;
          return (
            <section key={provider.id} className="cinematic-card-dark rounded-[22px] border border-white/[.07] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[.08] bg-black/20">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{provider.name}</h2>
                    {provider.primary && (
                      <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gold">
                        Beta
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{provider.subtitle}</p>
                </div>
                {provider.primary ? (
                  <button
                    onClick={connectHuawei}
                    className="flex shrink-0 items-center gap-1 rounded-xl gold-gradient px-3 py-2 text-xs font-semibold"
                    style={{ color: "var(--gold-foreground)" }}
                  >
                    Conectar
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">Próximamente</span>
                )}
              </div>
              {provider.primary && (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">PIN del perfil</span>
                    <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\\D/g, "").slice(0, 12))} className="w-full rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-sm tracking-[0.3em] outline-none focus:border-gold" placeholder="••••" />
                  </label>
                  <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                  {status === "connected" ? "Huawei Health conectado." : "Base de datos preparada para sincronización."}
                  </div>
                  <button onClick={checkHuawei} disabled={checking} className="text-left text-[11px] font-semibold text-gold">{checking ? "Comprobando…" : "Comprobar conexión"}</button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="mt-5 rounded-[22px] border border-dashed border-white/[.10] p-5">
        <p className="cinematic-label">DATOS QUE PODREMOS USAR</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {["Sueño", "Frecuencia cardíaca", "Entrenamientos", "Calorías", "Actividad diaria", "Recuperación"].map((item) => (
            <div key={item} className="rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5">
              {item}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
