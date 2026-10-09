import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { useAthleteProfile, useSaveAthleteProfile } from "@/lib/profile-store";
import { Card, Field, inputCls, num } from "./shared";

export const GOAL_OPTIONS = [
  "Fuerza",
  "Rendimiento",
  "CrossFit general",
  "Competición",
  "Hipertrofia",
  "Pérdida de grasa",
  "Resistencia",
  "Técnica",
  "Movilidad",
];

export const LEVELS = ["Principiante", "Intermedio", "Avanzado", "Competidor"];

export function ProfileForm() {
  const { data: profile } = useAthleteProfile();
  const save = useSaveAthleteProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (profile) setForm({ ...profile, goals: profile.goals ?? [] });
  }, [profile?.id, profile?.updated_at]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const goals: string[] = form.goals ?? [];

  async function onAvatar(file: File) {
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) {
      return toast.error("Selecciona una imagen");
    }
    let dataUrl: string;
    try {
      dataUrl = await resizeImage(file, 320);
    } catch {
      return toast.error("No se ha podido leer la imagen. Prueba con una foto JPG o PNG.");
    }
    set("avatar_url", dataUrl);
    try {
      await save.mutateAsync({ avatar_url: dataUrl } as any);
      toast.success("Foto actualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "No se ha podido guardar la foto");
    }
  }

  async function onSave() {
    try {
      await save.mutateAsync({
        display_name: form.display_name ?? null,
        avatar_url: form.avatar_url ?? null,
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        height_cm: num(form.height_cm),
        current_weight_kg: num(form.current_weight_kg),
        target_weight_kg: num(form.target_weight_kg),
        crossfit_start_date: form.crossfit_start_date || null,
        box_name: form.box_name || null,
        level: form.level || null,
        weekly_target: num(form.weekly_target),
        goals,
      } as any);
      toast.success("Perfil guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  }

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px]"
            style={{ background: "linear-gradient(140deg,#EBD6A6,#D8B46B)", color: "#0A0A0B" }}
          >
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onAvatar(e.target.files[0])}
          />
          <div className="min-w-0 flex-1">
            <Field label="Nombre">
              <input className={inputCls} value={form.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} maxLength={60} />
            </Field>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <Field label="Nacimiento">
            <input type="date" className={`${inputCls} block appearance-none [-webkit-appearance:none] text-left`} value={form.birth_date ?? ""} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <Field label="Sexo">
            <select className={inputCls} value={form.sex ?? ""} onChange={(e) => set("sex", e.target.value)}>
              <option value="">—</option>
              <option value="M">Hombre</option>
              <option value="F">Mujer</option>
              <option value="X">Otro</option>
            </select>
          </Field>
          <Field label="Altura (cm)">
            <input inputMode="decimal" className={inputCls} value={form.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value)} />
          </Field>
          <Field label="Peso actual (kg)">
            <input inputMode="decimal" className={inputCls} value={form.current_weight_kg ?? ""} onChange={(e) => set("current_weight_kg", e.target.value)} />
          </Field>
          <Field label="Peso objetivo (kg)">
            <input inputMode="decimal" className={inputCls} value={form.target_weight_kg ?? ""} onChange={(e) => set("target_weight_kg", e.target.value)} />
          </Field>
          <Field label="Inicio en CrossFit">
            <input type="date" className={`${inputCls} block appearance-none [-webkit-appearance:none] text-left`} value={form.crossfit_start_date ?? ""} onChange={(e) => set("crossfit_start_date", e.target.value)} />
          </Field>
          <Field label="Box">
            <input className={inputCls} value={form.box_name ?? ""} onChange={(e) => set("box_name", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Nivel">
            <select className={inputCls} value={form.level ?? ""} onChange={(e) => set("level", e.target.value)}>
              <option value="">—</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label="Sesiones/semana">
            <input inputMode="numeric" className={inputCls} value={form.weekly_target ?? ""} onChange={(e) => set("weekly_target", e.target.value)} />
          </Field>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Objetivos principales</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => {
              const active = goals.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => set("goals", active ? goals.filter((x) => x !== g) : [...goals, g])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active ? "border-transparent gold-gradient" : "border-border text-muted-foreground"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={save.isPending}
          className="mt-6 w-full rounded-[18px] gold-gradient py-3 text-sm font-semibold transition active:scale-[0.99]"
        >
          {save.isPending ? "Guardando…" : "Guardar perfil"}
        </button>
      </Card>
    </div>
  );
}

export async function decodeImage(file: File): Promise<{ width: number; height: number; source: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as any);
      return { width: bitmap.width, height: bitmap.height, source: bitmap };
    } catch {
      /* algunos formatos (HEIC, progresivos) fallan aquí: usamos <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode_failed"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, source: img };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function resizeImage(file: File, max: number): Promise<string> {
  const { width, height, source } = await decodeImage(file);
  if (!width || !height) throw new Error("decode_failed");
  const scale = Math.min(1, max / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > 300_000 && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (!out.startsWith("data:image/")) throw new Error("encode_failed");
  return out;
}

/* ---------------- 2. Body data ---------------- */
