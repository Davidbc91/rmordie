/**
 * Login con enlace o código por correo (Supabase Auth, sin contraseñas).
 *
 * El correo trae un enlace y, si la plantilla lo incluye, un código de 6
 * dígitos. El código es la vía buena en iPhone con la app instalada en la
 * pantalla de inicio: el enlace se abriría en Safari y la sesión se quedaría
 * allí, no en la app.
 */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // La sesión se guarda en el dispositivo: funciona también sin conexión.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

export async function sendLoginEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error) throw error;
}

/** Mensaje legible para los errores de Supabase Auth más habituales. */
export function authErrorMessage(error: unknown): string {
  const raw = (error as { message?: string; status?: number })?.message ?? "";
  const status = (error as { status?: number })?.status;
  if (status === 429 || /rate limit|too many/i.test(raw)) {
    return "Has pedido demasiados correos seguidos. Espera un minuto y vuelve a intentarlo.";
  }
  if (/expired|invalid/i.test(raw) && /token|otp|code/i.test(raw)) {
    return "El código no es válido o ha caducado. Pide uno nuevo.";
  }
  if (/email/i.test(raw) && /invalid/i.test(raw)) return "Ese correo no parece válido.";
  return raw || "No se pudo completar el acceso. Inténtalo de nuevo.";
}
