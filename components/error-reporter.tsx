"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/logger";

/** Captura errores no controlados del navegador y los reporta de forma segura. */
export default function ErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      reportClientError(event.error ?? event.message, {
        source: "window.error",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason, {
        source: "unhandledrejection",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
