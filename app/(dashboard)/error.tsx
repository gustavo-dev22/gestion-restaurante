"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle size={32} aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">No se pudo cargar esta sección</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Ocurrió un error al procesar la información. Reintenta o vuelve al inicio.
        </p>
        {error.digest && <p className="mt-2 text-xs text-slate-500">Código: {error.digest}</p>}
      </div>
      <Button onClick={reset}>
        <RotateCcw size={18} /> Reintentar
      </Button>
    </div>
  );
}
