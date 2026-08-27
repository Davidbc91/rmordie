import { useState } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreatePost, type PostKind } from "@/lib/social";

const KINDS: Array<{ k: PostKind; label: string }> = [
  { k: "workout", label: "Entreno" },
  { k: "pr", label: "PR" },
  { k: "wod", label: "WOD" },
  { k: "benchmark", label: "Benchmark" },
  { k: "progress", label: "Progreso" },
  { k: "media", label: "Foto/Vídeo" },
  { k: "text", label: "Nota" },
];

export function Composer({
  onClose,
  initialKind = "workout",
  initialData,
  initialCaption = "",
}: {
  onClose: () => void;
  initialKind?: PostKind;
  initialData?: Record<string, any>;
  initialCaption?: string;
}) {
  const create = useCreatePost();
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [caption, setCaption] = useState(initialCaption);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [files, setFiles] = useState<File[]>([]);
  const [data, setData] = useState<Record<string, any>>(initialData ?? {});

  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v === "" ? undefined : v }));

  const submit = () => {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== "") clean[k] = isNaN(Number(v)) ? v : Number(v);
    if (kind === "pr" && (!clean.exercise || clean.weight == null)) return toast.error("Indica ejercicio y peso");
    create.mutate(
      { kind, caption, data: clean, visibility, files },
      {
        onSuccess: () => {
          toast.success("Publicado");
          onClose();
        },
        onError: (e: any) => toast.error(e.message ?? "No se pudo publicar"),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[24px] border-t p-5 pb-10"
        style={{ background: "#0C0C0C", borderColor: "#1F1F1F" }}
      >
        <div className="flex items-center justify-between">
          <p className="eyebrow">Nueva publicación</p>
          <button aria-label="Cerrar" onClick={onClose} className="pressable rounded-full p-2 text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {KINDS.map((k) => (
            <button
              key={k.k}
              onClick={() => setKind(k.k)}
              className="shrink-0 rounded-full px-3.5 py-2 text-xs"
              style={kind === k.k ? { background: "#FFFFFF", color: "#000" } : { background: "#181818", color: "#9A9A9A" }}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {kind === "pr" && (
            <>
              <Field label="Ejercicio" value={data.exercise ?? ""} onChange={(v) => set("exercise", v)} className="col-span-2" />
              <Field label="Peso (kg)" value={data.weight ?? ""} onChange={(v) => set("weight", v)} type="number" />
              <Field label="Rep max" value={data.rep_max ?? ""} onChange={(v) => set("rep_max", v)} type="number" />
            </>
          )}
          {(kind === "wod" || kind === "benchmark") && (
            <>
              <Field label="Nombre" value={data.name ?? ""} onChange={(v) => set("name", v)} className="col-span-2" />
              <Field label="Tiempo (seg)" value={data.time_seconds ?? ""} onChange={(v) => set("time_seconds", v)} type="number" />
              <Field label="Score" value={data.score ?? ""} onChange={(v) => set("score", v)} />
              <Field label="Escala" value={data.scale ?? ""} onChange={(v) => set("scale", v)} placeholder="RX / Scaled" />
              <Field label="RPE" value={data.rpe ?? ""} onChange={(v) => set("rpe", v)} type="number" />
            </>
          )}
          {(kind === "workout" || kind === "progress") && (
            <>
              <Field label="Título" value={data.title ?? ""} onChange={(v) => set("title", v)} className="col-span-2" />
              <Field label="Peso (kg)" value={data.weight ?? ""} onChange={(v) => set("weight", v)} type="number" />
              <Field label="Series" value={data.sets ?? ""} onChange={(v) => set("sets", v)} type="number" />
              <Field label="Reps" value={data.reps ?? ""} onChange={(v) => set("reps", v)} type="number" />
              <Field label="RPE" value={data.rpe ?? ""} onChange={(v) => set("rpe", v)} type="number" />
            </>
          )}
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          placeholder="Cuenta cómo fue… usa #hashtags"
          className="mt-3 w-full rounded-[16px] border bg-transparent px-3.5 py-3 text-sm outline-none focus:border-foreground/40"
          style={{ borderColor: "#242424" }}
        />

        <div className="mt-3 flex items-center gap-2">
          <label className="pressable flex cursor-pointer items-center gap-2 rounded-[14px] border px-3.5 py-2.5 text-xs" style={{ borderColor: "#242424" }}>
            <ImagePlus className="h-4 w-4" />
            {files.length ? `${files.length} archivo(s)` : "Añadir media"}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
            />
          </label>
          <button
            onClick={() => setVisibility((v) => (v === "public" ? "private" : "public"))}
            className="rounded-[14px] border px-3.5 py-2.5 text-xs"
            style={{ borderColor: "#242424" }}
          >
            {visibility === "public" ? "Público" : "Solo yo"}
          </button>
        </div>

        <button
          onClick={submit}
          disabled={create.isPending}
          className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] py-3.5 text-sm font-semibold"
          style={{ background: "#FFFFFF", color: "#000" }}
        >
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Publicar
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-[14px] border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
        style={{ borderColor: "#242424" }}
      />
    </label>
  );
}
