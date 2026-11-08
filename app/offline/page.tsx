import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Sin conexión — Gestión Restaurante",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <WifiOff size={32} aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sin conexión</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          No se pudo conectar con el servidor. Las comandas pendientes se enviarán
          automáticamente cuando recuperes el Wi-Fi.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Reintentar
      </Link>
    </div>
  );
}
