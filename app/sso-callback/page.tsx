"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { http, getErrorMessage } from "@/lib/http";
import type { AuthUserLike } from "@/lib/roles";
import { useAuthStore } from "@/lib/store";

interface SsoCallbackResponse {
  success: boolean;
  usuario?: AuthUserLike;
  redirectTo?: string;
  message?: string;
}

function LoadingCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Validando acceso con SASI</h1>
        <p className="mt-2 text-sm text-slate-600">
          Estamos verificando tus credenciales. Un momento por favor.
        </p>
        <Loader2
          className="mx-auto mt-6 animate-spin text-blue-600"
          size={28}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function SsoCallbackContent() {
  const params = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const code = params.get("code");
  const state = params.get("state");
  const sasiError = params.get("error") ?? params.get("error_description");

  const displayError =
    error ??
    (sasiError
      ? sasiError === "access_denied"
        ? "No se autorizó el acceso al Sistema de Restaurante."
        : sasiError
      : !code || !state
        ? "La respuesta de autenticación está incompleta. Inicia sesión nuevamente."
        : null);

  useEffect(() => {
    if (started.current || displayError || !code || !state) return;
    started.current = true;

    http
      .post<SsoCallbackResponse>(
        "/api/auth/sso/callback",
        { code, state },
        { skipAuthRedirect: true }
      )
      .then((data) => {
        if (!data.success || !data.usuario) {
          throw new Error(data.message || "No se pudo completar el inicio de sesión.");
        }
        setAuth(data.usuario);
        window.location.replace(data.redirectTo || "/dashboard");
      })
      .catch((err) => {
        setError(
          getErrorMessage(
            err,
            "No se pudo completar el inicio de sesión con SASI. Intenta nuevamente."
          )
        );
      });
  }, [code, state, displayError, setAuth]);

  if (!displayError) {
    return <LoadingCard />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle size={28} aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">No se pudo iniciar sesión</h1>
        <p role="alert" className="mt-2 text-sm text-slate-600">
          {displayError}
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <SsoCallbackContent />
    </Suspense>
  );
}
