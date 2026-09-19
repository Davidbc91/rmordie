import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { useSyncState } from "@/lib/offline/use-sync";

/** Discreet Liquid Glass connection pill, anchored above the bottom navigation. */
export function SyncIndicator() {
  const { online, pending, syncing, error, conflict } = useSyncState();
  const [justSynced, setJustSynced] = useState(false);
  const prevQueued = useRef(0);

  const queued = pending + syncing + error;

  useEffect(() => {
    if (prevQueued.current > 0 && queued === 0 && online) {
      setJustSynced(true);
      const t = window.setTimeout(() => setJustSynced(false), 3200);
      prevQueued.current = queued;
      return () => window.clearTimeout(t);
    }
    prevQueued.current = queued;
  }, [queued, online]);

  let icon = <Check className="h-3 w-3" />;
  let label = "Todo sincronizado";
  let tone = "rgba(255,255,255,0.06)";
  let visible = false;

  if (!online) {
    icon = <CloudOff className="h-3 w-3" />;
    label = queued > 0 ? "Offline · cambios guardados" : "Offline";
    tone = "rgba(255,255,255,0.06)";
    visible = true;
  } else if (syncing > 0) {
    icon = <RefreshCw className="h-3 w-3 animate-spin" />;
    label = "Sincronizando…";
    tone = "rgba(216,180,107,0.14)";
    visible = true;
  } else if (conflict > 0) {
    icon = <AlertTriangle className="h-3 w-3" />;
    label = `${conflict} cambio${conflict > 1 ? "s" : ""} por revisar`;
    tone = "rgba(216,180,107,0.14)";
    visible = true;
  } else if (pending + error > 0) {
    icon = <RefreshCw className="h-3 w-3" />;
    label = `${pending + error} cambio${pending + error > 1 ? "s" : ""} por enviar`;
    tone = "rgba(216,180,107,0.10)";
    visible = true;
  } else if (justSynced) {
    visible = true;
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-40 flex justify-center px-4">
      <span
        className="glass animate-fade flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
        style={{ background: tone }}
        role="status"
      >
        {icon}
        {label}
      </span>
    </div>
  );
}
