"use client";

import { useEffect } from "react";
import { HttpError, http } from "@/lib/http";
import {
  hasStoredSession,
  isSessionExpiryInProgress,
  notifySessionExpired,
} from "@/lib/session-expiry";
import { useAuthStore } from "@/lib/store";

const CHECK_INTERVAL_MS = 60_000;
const INITIAL_GRACE_MS = 500;

/**
 * Vigila la sesión mientras el dashboard está abierto:
 * - Detecta si el usuario borró su estado local (localStorage).
 * - Valida la cookie cada minuto y al recuperar el foco.
 * - Si no hay estado local pero la cookie sigue viva, fuerza un re-login
 *   para restaurar la caché de usuario y menús.
 */
export default function SessionWatcher() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;

    const checkCookie = async (expireIfValid: boolean) => {
      if (cancelled || isSessionExpiryInProgress()) return;
      try {
        await http.get("/api/auth/session", { skipAuthRedirect: true });
        if (expireIfValid) notifySessionExpired();
      } catch (error) {
        if (
          !expireIfValid &&
          error instanceof HttpError &&
          error.status === 401
        ) {
          notifySessionExpired();
        }
      }
    };

    if (!isAuthenticated) {
      if (!hasStoredSession()) void checkCookie(true);
      return;
    }

    const verify = async () => {
      if (cancelled || isSessionExpiryInProgress()) return;

      if (!hasStoredSession()) {
        window.setTimeout(() => {
          if (!cancelled && !isSessionExpiryInProgress() && !hasStoredSession()) {
            notifySessionExpired();
          }
        }, INITIAL_GRACE_MS);
        return;
      }

      await checkCookie(false);
    };

    verify();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") verify();
    }, CHECK_INTERVAL_MS);

    const onFocus = () => verify();
    const onVisibility = () => {
      if (document.visibilityState === "visible") verify();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasHydrated, isAuthenticated]);

  return null;
}
