/**
 * Login con enlace o código por correo (Supabase Auth), o con contraseña
 * opcional que cada uno crea en Ajustes.
 *
 * El correo trae un enlace y, si la plantilla lo incluye, un código (6–8
 * dígitos según la configuración del proyecto). El código es la vía buena en iPhone con la app instalada en la
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

/**
 * Acceso con contraseña: pensado para la app instalada en el iPhone, que no
 * comparte sesión con Safari/Chrome y no puede usar el enlace del correo.
 */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

/** Pone o cambia la contraseña de la cuenta con la sesión actual. */
export async function setAccountPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
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
  if (/invalid login credentials/i.test(raw)) {
    return "Correo o contraseña incorrectos. Si aún no tienes contraseña, entra con el código y créala en Ajustes.";
  }
  if (/email not confirmed/i.test(raw)) return "Confirma primero tu correo entrando con el código.";
  if (/reauthentication/i.test(raw)) {
    return "Por seguridad, cierra sesión, vuelve a entrar con el correo y crea la contraseña justo después.";
  }
  if (/same.*password|different from the old/i.test(raw)) return "La contraseña nueva es igual que la anterior.";
  if (/password/i.test(raw) && /(short|least|weak)/i.test(raw)) return "La contraseña es demasiado corta o débil.";
  if (/email/i.test(raw) && /invalid/i.test(raw)) return "Ese correo no parece válido.";
  return raw || "No se pudo completar el acceso. Inténtalo de nuevo.";
}
