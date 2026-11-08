"use client";

import { toastWarning } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/store";

const AUTH_STORAGE_KEY = "gr-auth-storage";

let sessionExpiryInProgress = false;

export function isSessionExpiryInProgress() {
  return sessionExpiryInProgress;
}

/** Indica si el estado de sesión del cliente sigue en localStorage. */
export function hasStoredSession() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    // Si el navegador bloquea el storage, no lo tratamos como sesión perdida.
    return true;
  }
}

/**
 * Cierra la sesión local y la cookie del servidor, avisa al usuario y
 * redirige al login tras 2 segundos. Es idempotente.
 */
export function notifySessionExpired() {
  if (typeof window === "undefined" || sessionExpiryInProgress) return;
  sessionExpiryInProgress = true;

  try {
    useAuthStore.getState().logout();
  } catch {
    // El store puede no estar disponible; continuamos con la redirección.
  }

  fetch("/api/auth/logout", { method: "POST" }).catch(() => {
    // Fire-and-forget: aunque falle, redirigimos igualmente.
  });

  if (window.location.pathname.startsWith("/login")) return;

  toastWarning(
    "Tu sesión ha expirado",
    "Redirigiendo al inicio de sesión en unos segundos..."
  );

  const current = `${window.location.pathname}${window.location.search}`;
  window.setTimeout(() => {
    window.location.assign(
      `/login?redirect=${encodeURIComponent(current)}&expired=1`
    );
  }, 2000);
}
