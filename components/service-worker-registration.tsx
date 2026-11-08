"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const enabled =
      process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";
    if (!enabled) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla el registro (HTTP, navegador sin soporte), la app sigue funcionando.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
