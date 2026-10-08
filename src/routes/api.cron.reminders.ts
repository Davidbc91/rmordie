import { createFileRoute } from "@tanstack/react-router";

// Lo llama la tarea programada de la base de datos cada 15 minutos.
// Es seguro llamarlo de más: cada aviso se envía como mucho una vez al día.
export const Route = createFileRoute("/api/cron/reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { runReminders } = await import("@/lib/reminders.server");
        const result = await runReminders(new Date());
        return Response.json(result);
      },
    },
  },
});
