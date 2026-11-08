import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Layers,
  LayoutGrid,
  Package,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { getDashboardStatsCached } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStatsCached();
  const ocupacion = stats.mesasTotal
    ? Math.round((stats.mesasOcupadas / stats.mesasTotal) * 100)
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Panel de Administración"
        description="Resumen general de tu restaurante"
      />

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Package size={24} aria-hidden="true" />
            </div>
            <span className="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Carta</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.productos}</h3>
          <p className="text-sm text-slate-600">Productos Activos</p>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
              <Layers size={24} aria-hidden="true" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.categorias}</h3>
          <p className="text-sm text-slate-600">Categorías</p>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <CheckCircle size={24} aria-hidden="true" />
            </div>
            <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Salón</span>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">
            {stats.mesasLibres} / {stats.mesasTotal}
          </h3>
          <p className="text-sm text-slate-600">Mesas Disponibles</p>
        </Card>

        <Card
          className={`${stats.stockBajo > 0 ? "border-orange-200 bg-orange-50" : "border-slate-200 bg-white"} p-6 transition-colors`}
        >
          <div
            className={`mb-4 flex items-start justify-between ${stats.stockBajo > 0 ? "text-orange-600" : "text-slate-600"}`}
          >
            <div className={`rounded-xl p-3 ${stats.stockBajo > 0 ? "bg-orange-100" : "bg-slate-50"}`}>
              <AlertTriangle size={24} aria-hidden="true" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-slate-800">{stats.stockBajo}</h3>
          <p className="text-sm text-slate-600">Productos con Stock Bajo</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:col-span-2">
          <h2 className="mb-6 text-xl font-bold text-slate-800">Estado del Salón</h2>
          <div className="flex flex-col items-center gap-8 sm:flex-row">
            <div
              role="img"
              aria-label={`Ocupación del salón: ${ocupacion}%. ${stats.mesasLibres} mesas libres y ${stats.mesasOcupadas} ocupadas.`}
              className="relative size-32"
            >
              <div className="flex size-full items-center justify-center rounded-full border-[12px] border-slate-100 text-center">
                <div>
                  <p className="text-2xl font-bold text-slate-800">{ocupacion}%</p>
                  <p className="text-xs font-bold uppercase text-slate-600">Ocupado</p>
                </div>
              </div>
            </div>
            <div className="w-full flex-1 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded-full bg-emerald-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-600">Mesas Libres</span>
                </div>
                <span className="font-bold text-slate-800">{stats.mesasLibres}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                <div className="flex items-center gap-3">
                  <div className="size-3 rounded-full bg-rose-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-slate-600">Mesas Ocupadas</span>
                </div>
                <span className="font-bold text-slate-800">{stats.mesasOcupadas}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="px-2 text-lg font-bold text-slate-800">Acciones Rápidas</h2>
          <Link
            href="/admin/productos"
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-500 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <Package size={20} aria-hidden="true" />
              </div>
              <span className="font-semibold text-slate-700">Gestionar Carta</span>
            </div>
            <ArrowRight size={18} className="text-slate-400" aria-hidden="true" />
          </Link>

          <Link
            href="/admin/mesas"
            className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-500 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <LayoutGrid size={20} aria-hidden="true" />
              </div>
              <span className="font-semibold text-slate-700">Control de Mesas</span>
            </div>
            <ArrowRight size={18} className="text-slate-400" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
