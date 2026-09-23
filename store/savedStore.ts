import { create } from "zustand";
import { workersApi } from "@/lib/api";

interface SavedStore {
  /** WorkerProfile ids the signed-in user has saved. */
  ids: Set<string>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  clear: () => void;
  isSaved: (workerId: string) => boolean;
  toggle: (workerId: string) => Promise<void>;
}

/**
 * Saved worker ids, held client-side so every heart — in lists, on the map
 * card, on the profile — renders from one source without a request per row.
 */
export const useSavedStore = create<SavedStore>((set, get) => ({
  ids: new Set<string>(),
  hydrated: false,

  hydrate: async () => {
    try {
      const ids = await workersApi.savedIds();
      set({ ids: new Set(ids), hydrated: true });
    } catch {
      // Offline or signed out — hearts stay empty rather than blocking the UI.
      set({ hydrated: true });
    }
  },

  clear: () => set({ ids: new Set<string>(), hydrated: false }),

  isSaved: (workerId) => get().ids.has(workerId),

  toggle: async (workerId) => {
    const wasSaved = get().ids.has(workerId);

    // Optimistic: the heart fills on tap, not on round-trip.
    const optimistic = new Set(get().ids);
    if (wasSaved) optimistic.delete(workerId);
    else optimistic.add(workerId);
    set({ ids: optimistic });

    try {
      if (wasSaved) await workersApi.unsave(workerId);
      else await workersApi.save(workerId);
    } catch (err) {
      // Put it back the way it was, reading current state so a second tap
      // mid-flight does not get clobbered by a stale snapshot.
      const reverted = new Set(get().ids);
      if (wasSaved) reverted.add(workerId);
      else reverted.delete(workerId);
      set({ ids: reverted });
      throw err;
    }
  },
}));
