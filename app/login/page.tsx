"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { getHomePath } from "@/lib/roles";
import { http } from "@/lib/http";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/Button";

const subscribeToUrl = () => () => {};
const getUrlSearch = () => window.location.search;
const getServerUrlSearch = () => "";

function getSsoError(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get("error");
  if (!code) return null;

  const description = params.get("error_description");
  const mensajes: Record<string, string> = {
    sasi_unavailable:
      "No se pudo conectar con SASI. Verifica que el servicio esté disponible e inténtalo nuevamente.",
    sso_config:
      "La integración con SASI no está configurada correctamente. Contacta al administrador.",
  };
  return description || mensajes[code] || "No se pudo iniciar sesión con SASI.";
}

export default function LoginPage() {
  const [ssoLoading, setSsoLoading] = useState(false);
  const search = useSyncExternalStore(
    subscribeToUrl,
    getUrlSearch,
    getServerUrlSearch
  );
  const ssoError = getSsoError(search);

  const logout = useAuthStore((state) => state.logout);
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const router = useRouter();

  const getLoginRedirect = () =>
    getSafeRedirect(new URLSearchParams(window.location.search).get("redirect"));

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    let active = true;
    // Valida que la cookie de sesión siga vigente antes de redirigir.
    http
      .get("/api/auth/session", { skipAuthRedirect: true })
      .then(() => {
        if (active) router.replace(getLoginRedirect() ?? getHomePath(user));
      })
      .catch(() => {
        if (active) logout();
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, isAuthenticated, user, router, logout]);

  const handleSso = () => {
    setSsoLoading(true);
    const redirect = getLoginRedirect();
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    window.location.assign(`/api/auth/sso/start${query}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">
              Gestión Restaurante
            </h1>
            <p className="mt-2 text-slate-600">Gestión Centralizada SASI</p>
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full uppercase tracking-wide"
            onClick={handleSso}
            loading={ssoLoading}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            Iniciar sesión con SASI
          </Button>

          <p className="mt-3 text-center text-xs text-slate-500">
            Serás redirigido al portal de SASI para autenticarte.
          </p>

          {ssoError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{ssoError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
