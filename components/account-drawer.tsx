"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Home,
  KeyRound,
  Layers3,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/store";
import { http } from "@/lib/http";
import { cn, formatDateTime } from "@/lib/utils";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { SessionPayload } from "@/lib/auth/session";

interface AccountDrawerProps {
  open: boolean;
  onClose: () => void;
  session?: SessionPayload | null;
}

const SECTION_LABELS: Record<string, string> = {
  admin: "Administración",
  mesero: "Mesero",
  cocina: "Cocina / Bar",
  caja: "Caja",
};

function AccountDataRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof UserRound;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-0.5 break-words text-sm font-semibold text-slate-800">{children}</div>
      </div>
    </div>
  );
}

export default function AccountDrawer({ open, onClose, session }: AccountDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusTrap(open, drawerRef, onClose);

  const nombre = user?.nombreCompleto || session?.nombre || "Usuario";
  const rol = session?.rol || "Usuario";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "U";
  const authMethod =
    session?.authMethod === "sso"
      ? "SSO SASI"
      : session
        ? "Inicio de sesión directo"
        : "Sesión no disponible";
  const sectors =
    session?.sections?.length
      ? session.sections.map((section) => SECTION_LABELS[section] ?? section).join(", ")
      : "Sin secciones asignadas";
  const sesionIniciada = session?.iat
    ? formatDateTime(new Date(session.iat * 1000))
    : "No disponible";
  const sesionExpira = session?.exp
    ? formatDateTime(new Date(session.exp * 1000))
    : "No disponible";

  const requestLogout = () => {
    onClose();
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    let ssoLogoutUrl: string | undefined;
    try {
      const data = await http.post<{ success: boolean; ssoLogoutUrl?: string }>(
        "/api/auth/logout",
        undefined,
        { skipAuthRedirect: true }
      );
      ssoLogoutUrl = data?.ssoLogoutUrl;
    } catch {
      // Aunque falle el servidor, se limpia la sesión local.
    } finally {
      logout();
      setLogoutOpen(false);
      setLoggingOut(false);
    }

    if (ssoLogoutUrl) {
      window.location.assign(ssoLogoutUrl);
      return;
    }
    router.replace("/login");
  };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <aside
        ref={drawerRef}
        id="account-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-drawer-title"
        aria-hidden={!open}
        tabIndex={-1}
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex h-full w-[min(100vw-1rem,24rem)] flex-col bg-slate-50 shadow-2xl transition-transform duration-300 ease-out",
          open ? "visible translate-x-0" : "invisible translate-x-full"
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-5">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
              Mi cuenta
            </p>
            <h2 id="account-drawer-title" className="mt-1 text-xl font-bold text-slate-900">
              {nombre}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">{rol}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de cuenta"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center gap-4 rounded-2xl bg-slate-900 p-4 text-white">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-black">
              {inicial}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight">{nombre}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-blue-300">
                {rol}
              </p>
              <p className="mt-1 text-xs text-slate-400">Gestión Restaurante</p>
            </div>
          </div>

          <div className="grid gap-2">
            <AccountDataRow icon={ShieldCheck} label="Acceso">
              {authMethod}
            </AccountDataRow>
            <AccountDataRow icon={Layers3} label="Secciones habilitadas">
              {sectors}
            </AccountDataRow>
            <AccountDataRow icon={CalendarClock} label="Sesión iniciada">
              {sesionIniciada}
            </AccountDataRow>
            <AccountDataRow icon={CalendarClock} label="Sesión expira">
              {sesionExpira}
            </AccountDataRow>
            <AccountDataRow icon={KeyRound} label="ID de usuario SASI">
              <span className="break-all text-xs font-medium text-slate-600">
                {session?.sub ?? "No disponible"}
              </span>
            </AccountDataRow>
          </div>

          {session?.home && (
            <Link
              href={session.home}
              onClick={onClose}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700"
            >
              <span className="flex items-center gap-2">
                <Home size={16} aria-hidden="true" />
                Ir a mi inicio
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
        </div>

        <footer className="border-t border-slate-200 bg-white p-5">
          <Button type="button" variant="danger" className="w-full" onClick={requestLogout}>
            <LogOut size={18} aria-hidden="true" />
            Cerrar Sesión
          </Button>
        </footer>
      </aside>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={confirmLogout}
        title="¿Cerrar sesión?"
        description="Tendrás que ingresar tus credenciales nuevamente."
        confirmLabel="Sí, salir"
        variant="danger"
        loading={loggingOut}
      />
    </>
  );
}
