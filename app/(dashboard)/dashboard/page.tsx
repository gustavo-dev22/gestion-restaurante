import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { getServerSession } from "@/lib/auth/server-session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession();
  const nombre = session?.nombre ?? "Usuario";
  const rol = session?.rol ?? "Usuario";
  const home = session?.home ?? "/dashboard";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={`Bienvenido, ${nombre}`}
        description="Has ingresado correctamente al sistema."
      />

      <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <LayoutDashboard size={22} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Rol activo</p>
          <p className="text-xl font-bold text-slate-800">{rol}</p>
        </Card>

        <Link
          href={home}
          className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tu panel</p>
            <p className="text-xl font-bold text-slate-800">Ir a mi vista principal</p>
          </div>
          <ArrowRight className="text-slate-400 transition-colors group-hover:text-blue-600" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
