// Durable offline operation queue (IndexedDB). Survives app close, reboot and
// losing connection halfway through a sync.
import { QUEUE_STORE, hasIdb, idbDelete, idbGetAll, idbPut } from "./idb";

export type OpStatus = "pending" | "syncing" | "synced" | "error" | "conflict";
export type OpKind = "workout_result" | "personal_record";

export type QueuedOp = {
  /** unique id — prevents duplicates when the same operation is retried */
  id: string;
  /** natural key of the affected row: a newer local edit replaces the pending one */
  dedupe_key: string;
  kind: OpKind;
  user_id: string;
  payload: Record<string, unknown>;
  /** server `updated_at` we based this edit on (null = row did not exist locally) */
  base_updated_at: string | null;
  status: OpStatus;
  attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const QUEUE_EVENT = "rmordie:offline-queue";

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export async function listOps(): Promise<QueuedOp[]> {
  if (!hasIdb()) return [];
  try {
    const rows = await idbGetAll<QueuedOp>(QUEUE_STORE);
    return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

export async function enqueueOp(input: {
  kind: OpKind;
  dedupe_key: string;
  user_id: string;
  payload: Record<string, unknown>;
  base_updated_at: string | null;
}): Promise<QueuedOp> {
  const now = new Date().toISOString();
  const existing = (await listOps()).find(
    (o) => o.dedupe_key === input.dedupe_key && (o.status === "pending" || o.status === "error"),
  );
  const op: QueuedOp = existing
    ? { ...existing, payload: input.payload, status: "pending", error: null, updated_at: now }
    : {
        id: newId(),
        dedupe_key: input.dedupe_key,
        kind: input.kind,
        user_id: input.user_id,
        payload: input.payload,
        base_updated_at: input.base_updated_at,
        status: "pending",
        attempts: 0,
        error: null,
        created_at: now,
        updated_at: now,
      };
  await idbPut(QUEUE_STORE, op);
  emit();
  return op;
}

export async function saveOp(op: QueuedOp): Promise<void> {
  await idbPut(QUEUE_STORE, { ...op, updated_at: new Date().toISOString() });
  emit();
}

export async function dropOp(id: string): Promise<void> {
  await idbDelete(QUEUE_STORE, id);
  emit();
}

/** Keep the log tidy: synced operations are removed after a while. */
export async function pruneSynced(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  const cutoff = Date.now() - maxAgeMs;
  for (const op of await listOps()) {
    if (op.status === "synced" && new Date(op.updated_at).getTime() < cutoff) await dropOp(op.id);
  }
}

export function countByStatus(ops: QueuedOp[]) {
  return {
    pending: ops.filter((o) => o.status === "pending").length,
    syncing: ops.filter((o) => o.status === "syncing").length,
    error: ops.filter((o) => o.status === "error").length,
    conflict: ops.filter((o) => o.status === "conflict").length,
    synced: ops.filter((o) => o.status === "synced").length,
  };
}
