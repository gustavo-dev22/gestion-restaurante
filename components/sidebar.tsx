"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, X } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { SasiMenuObject, SasiSistema } from "@/lib/types";
import type { SessionPayload } from "@/lib/auth/session";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { resolveIcon } from "@/lib/icons";
import { http } from "@/lib/http";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  session?: SessionPayload | null;
}

export default function Sidebar({ open, onClose, session }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(open, sidebarRef, onClose);

  const sistemas = (user?.sistemas as SasiSistema[] | undefined) ?? [];
  const sistemaRestaurante = sistemas.find((s) => s.id === 13);
  const rolActivo =
    sistemaRestaurante?.roles?.find((r) => r.esPrincipal) || sistemaRestaurante?.roles?.[0];

  const nombre = user?.nombreCompleto || session?.nombre || "Usuario";
  const nombreRol = rolActivo?.nombreRol || session?.rol || "Usuario";

  const objetos: SasiMenuObject[] = rolActivo?.objetos || [];
  const menusPadre = objetos
    .filter((obj) => obj.tipo === "Menu")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  const isActive = (url?: string) => {
    if (!url || url === "#") return false;
    if (url === "/") return pathname === "/";
    return pathname === url || pathname.startsWith(url.endsWith("/") ? url : `${url}/`);
  };

  const handleLogout = () => {
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutOpen(false);
    let ssoLogoutUrl: string | undefined;
    try {
      const data = await http.post<{ success: boolean; ssoLogoutUrl?: string }>(
        "/api/auth/logout",
        undefined,
        { skipAuthRedirect: true }
      );
      ssoLogoutUrl = data?.ssoLogoutUrl;
    } catch {
      // Aunque falle el cierre de sesión del servidor, limpiamos el estado local.
    }
    logout();
    onClose();
    if (ssoLogoutUrl) {
      window.location.assign(ssoLogoutUrl);
      return;
    }
    router.replace("/login");
  };

  return (
    <>
      {/* Overlay móvil / tablet */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        ref={sidebarRef}
        id="app-sidebar"
        aria-label="Menú principal"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-slate-900 p-4 text-white shadow-xl transition-transform duration-300 ease-in-out",
          "lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-2 border-b border-slate-800 px-2 pb-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-blue-400">Gestión Restaurante</h2>
            <div className="mt-2">
              <p className="break-words text-sm font-medium leading-tight text-slate-200">
                {nombre}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-blue-500">
                {nombreRol}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {menusPadre.map((menu) => {
            const submenus = objetos.filter((sub) => sub.idPadre === menu.idObjeto);
            const IconComponent = resolveIcon(menu.icono);
            const hasUrl = Boolean(menu.url && menu.url !== "#");
            const active = isActive(menu.url);
            const parentActive = active || submenus.some((sub) => isActive(sub.url));

            return (
              <div key={menu.idObjeto}>
                {hasUrl ? (
                  <Link
                    href={menu.url || "#"}
                    onClick={onClose}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg p-2.5 transition-colors",
                      parentActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <IconComponent
                      size={20}
                      className={cn(
                        "shrink-0 transition-colors",
                        parentActive ? "text-blue-300" : "text-blue-400 group-hover:text-blue-300"
                      )}
                    />
                    <span className="min-w-0 truncate font-medium">{menu.nombre}</span>
                  </Link>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-2.5",
                      parentActive ? "text-white" : "text-slate-300"
                    )}
                  >
                    <IconComponent size={20} className="shrink-0 text-blue-400" />
                    <span className="min-w-0 truncate font-medium">{menu.nombre}</span>
                  </div>
                )}

                {submenus.length > 0 && (
                  <div className="ml-9 mt-1 space-y-1 border-l border-slate-700 pl-1">
                    {submenus.map((sub) => {
                      const subActive = isActive(sub.url);
                      return (
                        <Link
                          key={sub.idObjeto}
                          href={sub.url || "#"}
                          onClick={onClose}
                          className={cn(
                            "block rounded-md px-2 py-2 text-sm transition-colors",
                            subActive
                              ? "bg-slate-800 font-semibold text-white"
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          )}
                        >
                          {sub.nombre}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg p-2.5 text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
        title="¿Cerrar sesión?"
        description="Tendrás que ingresar tus credenciales nuevamente."
        confirmLabel="Sí, salir"
        variant="danger"
      />
    </>
  );
}
