// Local snapshot cache: every server read is mirrored into IndexedDB so the app
// can start and render from local data with no connection at all.
import { CACHE_STORE, hasIdb, idbGet, idbPut } from "./idb";

type CacheRow<T> = { key: string; data: T; updated_at: string };

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!hasIdb()) return null;
  try {
    const row = await idbGet<CacheRow<T>>(CACHE_STORE, key);
    return row ? row.data : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  if (!hasIdb()) return;
  try {
    await idbPut<CacheRow<T>>(CACHE_STORE, { key, data, updated_at: new Date().toISOString() });
  } catch {
    /* almacenamiento lleno o bloqueado: seguimos sin caché */
  }
}

/**
 * Read-through cache used inside React Query `queryFn`s.
 * Offline (or when the request fails) we serve the last synced snapshot.
 */
export async function offlineRead<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (!hasIdb()) return fetcher();

  if (!isOnline()) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
  }

  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh);
    return fresh;
  } catch (error) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return cached;
    throw error;
  }
}
