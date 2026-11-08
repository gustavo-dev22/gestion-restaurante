import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Compass size={32} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Error 404</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">Página no encontrada</h1>
        <p className="mt-1 max-w-md text-sm text-slate-600">
          La sección que buscas no existe o fue movida. Vuelve al inicio para continuar.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
