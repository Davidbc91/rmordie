/**
 * Esqueletos de carga con el mismo estilo de cristal que el resto de la app.
 * Se muestran mientras llegan los datos para que la pantalla no salte ni
 * enseñe mensajes de "sin datos" que todavía no son ciertos.
 */
type Variant = "calendar" | "workout" | "list";

export function PageSkeleton({ label, variant = "list" }: { label: string; variant?: Variant }) {
  return (
    <div className="space-y-3" role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}…</span>
      {variant === "calendar" && (
        <>
          <div className="glass h-12 animate-pulse rounded-2xl" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="glass aspect-square animate-pulse rounded-xl" />
            ))}
          </div>
        </>
      )}
      {variant === "workout" && (
        <>
          <div className="glass glass-sheen h-24 animate-pulse rounded-[24px]" />
          <div className="glass h-40 animate-pulse rounded-[24px]" />
          <div className="glass h-40 animate-pulse rounded-[24px]" />
        </>
      )}
      {variant === "list" &&
        Array.from({ length: 4 }, (_, i) => <div key={i} className="glass h-16 animate-pulse rounded-2xl" />)}
    </div>
  );
}
