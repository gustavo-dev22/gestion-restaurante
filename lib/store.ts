import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: any | null;
  token: string | null;
  hasHydrated: boolean; // <-- Nuevo campo
  setAuth: (user: any, token: string) => void;
  setHasHydrated: (state: boolean) => void; // <-- Nueva acción
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hasHydrated: false, // Inicia en falso
      setAuth: (user, token) => set({ user, token }),
      setHasHydrated: (state) => set({ hasHydrated: state }),
      logout: () => {
        set({ user: null, token: null });
        localStorage.removeItem('sasi-auth-storage'); // Limpieza extra
      }
    }),
    { 
      name: 'sasi-auth-storage',
      onRehydrateStorage: () => (state) => {
        // Esto se ejecuta cuando Zustand termina de leer el localStorage
        state?.setHasHydrated(true);
      },
    }
  )
);