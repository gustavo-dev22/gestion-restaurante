"use client";

import { Menu } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import type { SasiSistema } from "@/lib/types";
import type { SessionPayload } from "@/lib/auth/session";

interface TopbarProps {
  onMenuClick: () => void;
  menuOpen?: boolean;
  session?: SessionPayload | null;
}

export default function Topbar({ onMenuClick, menuOpen = false, session }: TopbarProps) {
  const user = useAuthStore((state) => state.user);

  const sistemas = (user?.sistemas as SasiSistema[] | undefined) ?? [];
  const sistemaRestaurante = sistemas.find((s) => s.id === 13);
  const rolActivo =
    sistemaRestaurante?.roles?.find((r) => r.esPrincipal) || sistemaRestaurante?.roles?.[0];

  const nombre: string = user?.nombreCompleto || session?.nombre || "Usuario";
  const rolNombre = rolActivo?.nombreRol || session?.rol || "Usuario";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="min-w-0 lg:hidden">
        <p className="truncate text-sm font-bold text-slate-800">Gestión Restaurante</p>
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-600">
          {rolNombre}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="max-w-[180px] truncate text-sm font-semibold text-slate-700">{nombre}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            {rolNombre}
          </p>
        </div>
        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
        >
          {inicial}
        </div>
      </div>
    </header>
  );
}
