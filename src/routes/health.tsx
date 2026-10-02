import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Activity, HeartPulse, Watch } from "lucide-react";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Salud — RM OR DIE" }] }),
  component: HealthPage,
});

function HealthPage() {
  return (
    <AppShell>
      <header>
        <p className="cinematic-label">HEALTH DATA</p>
        <h1 className="cinematic-title mt-3">Salud<span className="gold-text">.</span></h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Centraliza tus datos de recuperación y actividad para futuras funciones de Training Intelligence.
        </p>
      </header>

      <section className="mt-6 cinematic-card-strong rounded-[24px] p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <p className="cinematic-label">INTEGRACIONES</p>
            <h2 className="mt-1 text-lg font-semibold">Fuentes de salud</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Esta sección está preparada para conectar proveedores de salud. Todavía no solicita permisos ni datos.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ProviderCard icon={Watch} name="Huawei Health" status="Preparando conexión" />
        <ProviderCard icon={Activity} name="Health Connect" status="Próximamente" />
      </div>
    </AppShell>
  );
}

function ProviderCard({ icon: Icon, name, status }: { icon: typeof Watch; name: string; status: string }) {
  return (
    <section className="cinematic-card-dark rounded-[22px] border border-white/[.07] p-4">
      <Icon className="h-5 w-5 text-gold" />
      <h2 className="mt-4 font-semibold">{name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{status}</p>
    </section>
  );
}
