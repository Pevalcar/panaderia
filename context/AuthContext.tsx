import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../lib/supabase";

type UserContextType = {
  username: string | null;
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

type AuthStore = UserContextType & {
  setHydrated: (hydrated: boolean) => void;
  hydrateFromLegacyKey: () => Promise<void>;
};

const memoryStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};

const authStorage = createJSONStorage(() =>
  typeof window === "undefined" ? memoryStorage : AsyncStorage,
);

const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      username: null,
      isLoading: true,
      setHydrated: (hydrated) => set({ isLoading: !hydrated }),
      hydrateFromLegacyKey: async () => {
        const currentUsername = useAuthStore.getState().username;
        if (currentUsername) return;

        try {
          const legacyUser = await AsyncStorage.getItem("panaderia_user");
          if (legacyUser) {
            set({ username: legacyUser });
          }
        } catch (error) {
          console.error("Failed to migrate legacy auth key", error);
        }
      },
      login: async (name: string) => {
        try {
          await supabase
            .from("profiles")
            .upsert({ username: name }, { onConflict: "username" });
          await AsyncStorage.setItem("panaderia_user", name);
          set({ username: name });
        } catch (e) {
          console.error("Failed to login", e);
          throw e;
        }
      },
      logout: async () => {
        try {
          await AsyncStorage.removeItem("panaderia_user");
          set({ username: null });
        } catch (e) {
          console.error("Failed to logout", e);
        }
      },
    }),
    {
      name: "panaderia-auth",
      storage: authStorage,
      partialize: (state) => ({ username: state.username }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to hydrate auth store", error);
        }
        state?.setHydrated(true);
      },
    },
  ),
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isLoading = useAuthStore((state) => state.isLoading);
  const hydrateFromLegacyKey = useAuthStore(
    (state) => state.hydrateFromLegacyKey,
  );

  useEffect(() => {
    if (!isLoading) {
      hydrateFromLegacyKey();
    }
  }, [isLoading, hydrateFromLegacyKey]);

  return <>{children}</>;
}

export function useAuth(): UserContextType {
  const username = useAuthStore((state) => state.username);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const isLoading = useAuthStore((state) => state.isLoading);

  return { username, login, logout, isLoading };
}
