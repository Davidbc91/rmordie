import { createFileRoute } from "@tanstack/react-router";

// Lo llama la tarea programada de la base de datos cada 15 minutos.
// Es seguro llamarlo de más: cada aviso se envía como mucho una vez al día.
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const { runReminders } = await import("@/lib/reminders.server");
        const result = await runReminders(now);
        // Avisos por eventos (comentarios, retos, récords…). Si su tabla aún no
        // existe, falla aparte sin afectar a los recordatorios.
        let events: Record<string, number> | { error: string } = {};
        try {
          const { runEventNotifications } = await import("@/lib/notify-events.server");
          events = await runEventNotifications(now);
        } catch (e) {
          events = { error: (e as Error)?.message ?? "error" };
        }
        return Response.json({ ...result, events });
      },
    },
  },
});
