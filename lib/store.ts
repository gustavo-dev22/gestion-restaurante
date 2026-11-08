import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUserLike } from "@/lib/roles";

interface AuthState {
  user: AuthUserLike | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: AuthUserLike) => void;
  setHasHydrated: (state: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (user) => set({ user, isAuthenticated: true }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
      logout: () => {
        set({ user: null, isAuthenticated: false });
        if (typeof window !== "undefined") {
          localStorage.removeItem("gr-auth-storage");
          localStorage.removeItem("sasi-auth-storage");
        }
      },
    }),
    {
      name: "gr-auth-storage",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
