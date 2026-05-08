import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@/types";

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  clearUser: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setUser: async (user, token) => {
    set({ user, token, isAuthenticated: true });
    await AsyncStorage.setItem("mz_auth", JSON.stringify({ user, token }));
  },

  clearUser: async () => {
    set({ user: null, token: null, isAuthenticated: false });
    await AsyncStorage.removeItem("mz_auth");
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem("mz_auth");
      if (raw) {
        const { user, token } = JSON.parse(raw);
        set({ user, token, isAuthenticated: true });
      }
    } catch {
      // ignore
    }
  },
}));
