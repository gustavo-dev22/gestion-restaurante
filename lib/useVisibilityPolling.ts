"use client";

import { useEffect, useRef } from "react";

/**
 * Ejecuta `callback` periódicamente y se pausa automáticamente cuando la
 * pestaña/app está oculta. Al volver a estar visible ejecuta inmediatamente
 * y reanuda el intervalo. Evita recrear el intervalo por cambios de identidad
 * del callback.
 */
export function useVisibilityPolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  immediate = true
) {
  const callbackRef = useRef(callback);
  const startedRef = useRef(false);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;

    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      if (document.visibilityState === "visible") {
        if (immediate || startedRef.current) {
          void callbackRef.current();
        }
        startedRef.current = true;
        timer = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            void callbackRef.current();
          }
        }, intervalMs);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, immediate, intervalMs]);
}
