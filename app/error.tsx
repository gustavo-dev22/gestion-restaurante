"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/logger";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError(error, { boundary: "root", digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle size={32} aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Algo salió mal</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          Ocurrió un error inesperado al cargar esta sección. Puedes intentarlo nuevamente.
        </p>
        {error.digest && <p className="mt-2 text-xs text-slate-500">Código: {error.digest}</p>}
      </div>
      <Button onClick={reset}>
        <RotateCcw size={18} /> Reintentar
      </Button>
    </div>
  );
}
