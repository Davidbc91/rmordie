import { useEffect, useState } from "react";
import { SYNC_EVENT, getSyncState, type SyncState } from "./sync";

const SSR_STATE: SyncState = {
  online: true,
  pending: 0,
  syncing: 0,
  error: 0,
  conflict: 0,
  lastSyncedAt: null,
};

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(SSR_STATE);

  useEffect(() => {
    const read = () => setState({ ...getSyncState() });
    read();
    window.addEventListener(SYNC_EVENT, read);
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener(SYNC_EVENT, read);
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);

  return state;
}

/** Simple hydration-safe online flag. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const read = () => setOnline(navigator.onLine !== false);
    read();
    window.addEventListener("online", read);
    window.addEventListener("offline", read);
    return () => {
      window.removeEventListener("online", read);
      window.removeEventListener("offline", read);
    };
  }, []);
  return online;
}
