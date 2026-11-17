import { AlertTriangle, DollarSign, Package, TrendingDown } from "lucide-react";
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
        title="Inventario real"
        description="Valorización de insumos y reposición según stock mínimo."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex items-center justify-between rounded-2xl border-2 border-rose-100 bg-rose-50 p-6">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-rose-700">
              Insumos críticos
            </p>
            <h3 className="text-4xl font-black text-rose-600">
              {data.resumen.totalInsumosCriticos}
            </h3>
          </div>
          <AlertTriangle size={36} className="text-rose-300" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-600">
              Valor de insumos
            </p>
            <h3 className="text-3xl font-black text-slate-800">
              {formatCurrency(data.resumen.valorizacionBodega)}
            </h3>
          </div>
          <DollarSign size={36} className="text-slate-300" aria-hidden="true" />
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-blue-400">
              Estado general
            </p>
            <h3 className="text-2xl font-black italic">
              {data.resumen.totalInsumosCriticos > 0 ? "REABASTECER" : "ÓPTIMO"}
            </h3>
          </div>
          <Package size={36} className="opacity-30" aria-hidden="true" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <TrendingDown className="text-rose-600" aria-hidden="true" />
            Insumos que requieren reposición
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Se comparan contra el stock mínimo y el punto de recompra.
          </p>
        </div>
        <DataTable label="Insumos con stock crítico" minWidthClass="min-w-[1000px]">
          <thead className="bg-white">
            <tr className="border-b text-xs font-black uppercase text-slate-600">
              <th className="p-4">Insumo</th>
              <th className="p-4">Unidad</th>
              <th className="p-4 text-right">Stock total</th>
              <th className="p-4 text-right">Stock mínimo</th>
              <th className="p-4 text-right">Costo promedio</th>
              <th className="p-4 text-right">Valor</th>
              <th className="p-4">Almacenes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.critico.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-sm text-slate-600">
                  No hay insumos por debajo del mínimo.
                </td>
              </tr>
            ) : (
              data.critico.map((insumo) => (
                <tr key={insumo.id} className="transition-colors hover:bg-rose-50/30">
                  <td className="p-4">
                    <p className="font-bold text-slate-700">{insumo.nombre}</p>
                    <p className="font-mono text-xs text-slate-500">ID: {insumo.id}</p>
                  </td>
                  <td className="p-4 text-sm">{insumo.unidad}</td>
                  <td className="p-4 text-right text-xl font-black text-rose-600">
                    {insumo.stockTotal.toFixed(3)}
                  </td>
                  <td className="p-4 text-right text-sm text-slate-700">
                    {insumo.stockMinimo.toFixed(3)}
                  </td>
                  <td className="p-4 text-right text-sm text-slate-700">
                    {formatCurrency(insumo.costoPromedio)}
                  </td>
                  <td className="p-4 text-right text-sm font-bold text-slate-700">
                    {formatCurrency(insumo.valor)}
                  </td>
                  <td className="p-4 text-xs text-slate-600">
                    {insumo.almacenes.length > 0
                      ? insumo.almacenes
                          .map((almacen) => `${almacen.nombre}: ${almacen.cantidad.toFixed(3)}`)
                          .join(" · ")
                      : "Sin stock"}
                  </td>
                </tr>
              ))
            )}
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
