"use client";

import { useEffect } from "react";
import { flushOfflineQueue, getQueue } from "@/lib/offline-queue";
import { toastSuccess, toastError, toastInfo, toastWarning } from "@/components/ui/Toast";

export default function OfflineSync() {
  useEffect(() => {
    const sync = async () => {
      const pending = getQueue().length;
      if (pending === 0) return;

      toastInfo("Sincronizando", `${pending} comanda(s) pendientes de envío.`);
      const { sent, failed, errors } = await flushOfflineQueue();

      if (sent > 0) {
        toastSuccess("Comandas sincronizadas", `${sent} comanda(s) enviadas correctamente.`);
      }
      if (failed > 0) {
        toastError(
          "No se pudieron enviar todas las comandas",
          errors[0] ?? "Revisa la conexión e inténtalo de nuevo."
        );
      }
    };

    const handleOnline = () => {
      void sync();
    };
    const handleOffline = () => {
      toastWarning(
        "Sin conexión",
        "Las comandas se guardarán localmente y se enviarán al recuperar el Wi-Fi."
      );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (navigator.onLine) {
      void sync();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return null;
}
