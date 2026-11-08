"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { http } from "@/lib/http";
import { toastSuccess, toastError } from "@/components/ui/Toast";
import { timeAgo } from "@/lib/utils";

interface Llamado {
  id: number;
  fecha_creacion: string;
  usuarioId: string | null;
  nombreMesero: string | null;
  mesa: { id: number; numero: string };
}

export default function LlamadosMesero() {
  const [llamados, setLlamados] = useState<Llamado[]>([]);
  const [atendiendo, setAtendiendo] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const data = await http.get<Llamado[]>("/api/mesero/llamados", { timeoutMs: 8_000 });
      setLlamados(Array.isArray(data) ? data : []);
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo.
    }
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(cargar, 10_000);
    return () => clearInterval(interval);
  }, [cargar]);

  const atender = async (id: number) => {
    setAtendiendo(id);
    try {
      await http.patch("/api/mesero/llamados", { pedidoId: id });
      setLlamados((prev) => prev.filter((llamado) => llamado.id !== id));
      toastSuccess("Solicitud atendida", "El cliente verá el aviso en su pantalla.");
    } catch {
      toastError("No se pudo atender la solicitud", "Intenta nuevamente en unos segundos.");
    } finally {
      setAtendiendo(null);
    }
  };

  if (llamados.length === 0) return null;

  return (
    <section aria-labelledby="llamados-title" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {llamados.length} llamados de mesero pendientes: {llamados.map((llamado) => `Mesa ${llamado.mesa.numero}`).join(", ")}.
      </p>
      <div className="mb-3 flex items-center gap-2 text-amber-800">
        <BellRing size={18} aria-hidden="true" />
        <h2 id="llamados-title" className="font-bold">Llamados de mesero</h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1.5 text-xs font-black text-white">
          {llamados.length}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {llamados.map((llamado) => (
          <div
            key={llamado.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white p-3"
          >
            <div className="min-w-0">
              <p className="font-bold text-slate-800">Mesa {llamado.mesa.numero}</p>
              <p className="text-xs text-slate-600">
                {timeAgo(llamado.fecha_creacion)}
                {llamado.nombreMesero && llamado.nombreMesero !== "Sin asignar"
                  ? ` · ${llamado.nombreMesero}`
                  : " · Sin responsable"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => atender(llamado.id)}
              disabled={atendiendo === llamado.id}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
            >
              {atendiendo === llamado.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Atender
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
