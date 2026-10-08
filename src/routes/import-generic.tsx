import { createFileRoute, redirect } from "@tanstack/react-router";

// La importación genérica se ha unificado en /import, que ahora acepta
// Excel, CSV, TXT, PDF e imágenes. Esta ruta se conserva solo para que los
// enlaces o marcadores antiguos sigan funcionando.
export const Route = createFileRoute("/import-generic")({
  beforeLoad: () => {
    throw redirect({ to: "/import", replace: true });
  },
});
