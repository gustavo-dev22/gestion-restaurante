import { AlertTriangle, ArrowDownCircle, DollarSign, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { getInventarioReportCached } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InventarioReportePage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const data = await getInventarioReportCached(page);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Merma e Inventario"
        description="Control de existencias y valorización de activos"
      />

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-center justify-between rounded-2xl border-2 border-rose-100 bg-rose-50 p-8">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-rose-700">
              Stock Crítico
            </p>
            <h3 className="text-4xl font-black text-rose-600">
              {data.resumen.totalProductosCriticos} <span className="text-lg">Items</span>
            </h3>
          </div>
          <AlertTriangle size={40} className="text-rose-300" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-600">
              Valor en Bodega
            </p>
            <h3 className="text-3xl font-black text-slate-800">
              {formatCurrency(data.resumen.valorizacionBodega)}
            </h3>
          </div>
          <DollarSign size={40} className="text-slate-300" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-8 text-white shadow-xl">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-blue-400">
              Estado General
            </p>
            <h3 className="text-2xl font-black italic">
              {data.resumen.totalProductosCriticos > 5 ? "REABASTECER" : "ÓPTIMO"}
            </h3>
          </div>
          <Package size={40} className="opacity-30" aria-hidden="true" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-8">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <ArrowDownCircle className="text-rose-600" aria-hidden="true" /> Lista de Reposición Urgente
          </h2>
        </div>
        <DataTable>
          <caption className="sr-only">Productos con stock crítico y nivel de alerta</caption>
          <thead className="bg-white">
            <tr className="border-b text-xs font-black uppercase text-slate-600">
              <th className="p-6">Producto</th>
              <th className="p-6">Categoría</th>
              <th className="p-6 text-center">Stock Actual</th>
              <th className="p-6">Nivel de Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.critico.map((producto) => (
              <tr key={producto.id} className="transition-colors hover:bg-rose-50/30">
                <td className="p-6">
                  <p className="font-bold text-slate-700">{producto.nombre}</p>
                  <p className="font-mono text-xs italic text-slate-500">ID: {producto.id}</p>
                </td>
                <td className="p-6">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {producto.categoria?.nombre || "General"}
                  </span>
                </td>
                <td className="p-6 text-center text-xl font-black text-rose-600">
                  {producto.stock ?? 0}
                </td>
                <td className="p-6">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${Math.min(((producto.stock ?? 0) / 10) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs font-bold uppercase text-rose-600">
                    Crítico: Menos de 10 unidades
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <ServerPagination
          page={data.page}
          totalPages={data.totalPages}
          basePath="/admin/reportes/inventario"
        />
      </div>
    </div>
  );
}
