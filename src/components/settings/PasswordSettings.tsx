import { useState } from "react";
import { toast } from "sonner";
import { authErrorMessage, setAccountPassword } from "@/lib/auth";

const inputCls =
  "min-h-11 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-gold";

/**
 * Contraseña opcional de la cuenta. Sirve para entrar en la app instalada en
 * el iPhone, que no comparte sesión con el navegador ni abre el enlace del correo.
 */
export function PasswordSettings() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (password.length < 8) return toast.error("Usa al menos 8 caracteres");
    if (password !== password2) return toast.error("Las contraseñas no coinciden");
    setBusy(true);
    try {
      await setAccountPassword(password);
      setPassword("");
      setPassword2("");
      toast.success("Contraseña guardada. Ya puedes entrar con ella desde la app del iPhone.");
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 card-elevated p-5">
      <h2 className="text-sm font-semibold">Contraseña de acceso</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Opcional. Úsala para entrar en la app instalada en la pantalla de inicio del iPhone (botón «Tengo contraseña»).
      </p>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Contraseña nueva</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">Repite la contraseña</span>
        <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} />
      </label>
      <button onClick={save} disabled={busy} className="mt-4 rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50">
        {busy ? "Guardando…" : "Guardar contraseña"}
      </button>
    </section>
  );
}
