// Sync engine: drains the offline queue into Supabase as soon as the connection
// is back, with conflict detection (never a silent overwrite) and auto retry.
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isOnline } from "./cache";
import { QUEUE_EVENT, countByStatus, listOps, pruneSynced, saveOp, type QueuedOp } from "./queue";

export const SYNC_EVENT = "rmordie:sync-state";
const LAST_SYNC_KEY = "rmordie_last_sync_at";

export type SyncState = {
  online: boolean;
  pending: number;
  syncing: number;
  error: number;
  conflict: number;
  lastSyncedAt: string | null;
};

let state: SyncState = {
  online: true,
  pending: 0,
  syncing: 0,
  error: 0,
  conflict: 0,
  lastSyncedAt: null,
};

export function getSyncState(): SyncState {
  return state;
}

function publish(next: Partial<SyncState>) {
  state = { ...state, ...next };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

async function refreshCounts() {
  const counts = countByStatus(await listOps());
  publish({
    online: isOnline(),
    pending: counts.pending,
    syncing: counts.syncing,
    error: counts.error,
    conflict: counts.conflict,
  });
}

// ---------- one operation ----------

async function pushWorkoutResult(op: QueuedOp): Promise<"synced" | "conflict"> {
  const p = op.payload as Record<string, unknown>;
  const { data: current, error: readError } = await supabase
    .from("workout_results")
    .select("updated_at")
    .eq("user_id", op.user_id)
    .eq("month_key", String(p.month_key))
    .eq("week", Number(p.week))
    .eq("day_key", String(p.day_key))
    .eq("block_key", String(p.block_key))
    .maybeSingle();
  if (readError) throw readError;

  const serverUpdatedAt = (current?.updated_at as string | undefined) ?? null;
  // the row moved on the server since this offline edit was based on it
  if (serverUpdatedAt && serverUpdatedAt !== op.base_updated_at) return "conflict";

  const { error } = await supabase.from("workout_results").upsert(
    { ...p, user_id: op.user_id, updated_at: new Date().toISOString() } as never,
    { onConflict: "user_id,month_key,week,day_key,block_key" },
  );
  if (error) throw error;
  return "synced";
}

async function pushPersonalRecord(op: QueuedOp): Promise<"synced" | "conflict"> {
  const p = op.payload as Record<string, unknown>;
  const { data: current, error: readError } = await supabase
    .from("personal_records")
    .select("updated_at")
    .eq("user_id", op.user_id)
    .eq("exercise", String(p.exercise))
    .eq("rep_max", Number(p.rep_max ?? 1))
    .maybeSingle();
  if (readError) throw readError;

  const serverUpdatedAt = (current?.updated_at as string | undefined) ?? null;
  if (serverUpdatedAt && serverUpdatedAt !== op.base_updated_at) return "conflict";

  const { error } = await supabase.from("personal_records").upsert(
    { ...p, user_id: op.user_id, updated_at: new Date().toISOString() } as never,
    { onConflict: "user_id,exercise,rep_max" },
  );
  if (error) throw error;
  return "synced";
}

// ---------- queue drain ----------

let running = false;
let onSynced: (() => void) | null = null;
let syncedSomething = false;

export async function processQueue(): Promise<void> {
  if (running || !isOnline()) {
    await refreshCounts();
    return;
  }
  running = true;
  syncedSomething = false;
  try {
    const ops = (await listOps()).filter((o) => o.status === "pending" || o.status === "error");
    if (ops.length === 0) {
      await refreshCounts();
      return;
    }
    for (const op of ops) {
      if (!isOnline()) break;
      await saveOp({ ...op, status: "syncing" });
      await refreshCounts();
      try {
        const outcome =
          op.kind === "workout_result" ? await pushWorkoutResult(op) : await pushPersonalRecord(op);
        await saveOp({
          ...op,
          status: outcome,
          attempts: op.attempts + 1,
          error: outcome === "conflict" ? "Cambió también en el servidor" : null,
        });
        if (outcome === "synced") syncedSomething = true;
      } catch (error) {
        // connection dropped mid-sync or the write failed: stays queued for retry
        await saveOp({
          ...op,
          status: "error",
          attempts: op.attempts + 1,
          error: error instanceof Error ? error.message : "Error de sincronización",
        });
      }
      await refreshCounts();
    }
    if (typeof localStorage !== "undefined") {
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      publish({ lastSyncedAt: now });
    }
    await pruneSynced();
    if (syncedSomething) onSynced?.();
  } finally {
    running = false;
    await refreshCounts();
  }
}

/** Retry an operation that was parked as a conflict, using the current server row as base. */
export async function resolveConflictKeepLocal(id: string): Promise<void> {
  const op = (await listOps()).find((o) => o.id === id);
  if (!op) return;
  await saveOp({ ...op, status: "pending", base_updated_at: null, error: null });
  await processQueue();
}

// ---------- lifecycle ----------

let started = false;

export function startSyncEngine(queryClient?: QueryClient): () => void {
  if (typeof window === "undefined" || started) return () => {};
  started = true;
  if (queryClient) onSynced = () => queryClient.invalidateQueries();

  publish({
    online: isOnline(),
    lastSyncedAt: localStorage.getItem(LAST_SYNC_KEY),
  });

  const onOnline = () => {
    publish({ online: true });
    void processQueue();
  };
  const onOffline = () => publish({ online: false });
  const onVisible = () => {
    if (document.visibilityState === "visible") void processQueue();
  };
  const onQueue = () => void refreshCounts();

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  window.addEventListener(QUEUE_EVENT, onQueue);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(() => void processQueue(), 30_000);

  void processQueue();

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener(QUEUE_EVENT, onQueue);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
    started = false;
  };
}
