import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  useRouterState,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { PinGate } from "@/components/ui/gate";
import { AppShell } from "@/components/AppShell";
import { SplashScreen } from "@/components/ui/splash";
import { startSyncEngine } from "@/lib/offline/sync";
import { registerAppSw } from "@/lib/offline/register-sw";
import { fetchCustomMovements } from "@/lib/dictionary/custom";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold gold-text tabular">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta sección no existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-xl gold-gradient px-4 py-2 text-sm font-medium" style={{ color: "var(--gold-foreground)" }}>
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo se rompió</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-xl gold-gradient px-4 py-2 text-sm font-medium"
          style={{ color: "var(--gold-foreground)" }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      // App en la pantalla de inicio del iPhone
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "RM OR DIE" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { title: "RM OR DIE — Diario de entrenamiento" },
      { name: "description", content: "Diario minimalista de entrenamiento: planificación, PR, estadísticas y progreso." },
      { property: "og:title", content: "RM OR DIE" },
      { property: "og:description", content: "Diario minimalista de entrenamiento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      // "?v=" obliga al iPhone a pedir de nuevo el icono si guardó una versión
      // anterior o un fallo. Súbelo cuando cambie el logo.
      { rel: "icon", href: "/icon-192.png?v=3", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3", sizes: "180x180" },
      { rel: "apple-touch-icon-precomposed", href: "/apple-touch-icon-precomposed.png?v=3" },
      { rel: "manifest", href: "/manifest.json?v=3" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function MainRouteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const usePersistentMainShell =
    pathname === "/" ||
    pathname === "/calendar" ||
    pathname === "/records" ||
    pathname === "/social" ||
    pathname === "/social/";

  return usePersistentMainShell ? <AppShell>{children}</AppShell> : <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    const stop = startSyncEngine(queryClient);
    void registerAppSw();
    void fetchCustomMovements().catch(() => undefined);
    // iOS Safari ignora user-scalable=no: bloquear el gesto de pinza nativo
    const blockGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });
    return () => {
      stop();
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
    };
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreen>
        <PinGate>
          <MainRouteShell>
            <Outlet />
          </MainRouteShell>
        </PinGate>
        <Toaster theme="dark" position="top-center" />
      </SplashScreen>
    </QueryClientProvider>
  );
}
