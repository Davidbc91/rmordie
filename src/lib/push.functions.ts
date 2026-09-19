/**
 * Envío de notificaciones push (wrapper de server function).
 *
 * Aquí solo vive el wrapper `createServerFn`: la lógica de envío está en
 * `push.server.ts` y se carga dinámicamente dentro del handler, para que la
 * librería de Web Push nunca entre en el paquete del navegador.
 */
import { createServerFn } from "@tanstack/react-start";

export const notifyChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { messageId: string }) => {
    if (!input?.messageId || typeof input.messageId !== "string") {
      throw new Error("messageId requerido");
    }
    return { messageId: input.messageId };
  })
  .handler(async ({ data }) => {
    const { notifyChatMessageImpl } = await import("./push.server");
    return notifyChatMessageImpl(data.messageId);
  });
