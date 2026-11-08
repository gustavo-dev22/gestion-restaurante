import { Award, Medal, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { getPersonalReportCached } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DesempenoPersonalPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const reporte = await getPersonalReportCached(page);
  const ranking = reporte.ranking;
  const mejor = reporte.mejor;

  if (reporte.total === 0 || !mejor) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Desempeño del Personal"
          description="Ranking de productividad y eficiencia de ventas"
        />
        <p className="p-10 text-center font-bold text-slate-600">Sin datos de ventas aún.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Desempeño del Personal"
        description="Ranking de productividad y eficiencia de ventas"
      />

      <div className="mb-8 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 p-1 shadow-2xl shadow-amber-200">
        <div className="flex flex-col items-center justify-between rounded-[1.4rem] bg-white p-8 md:flex-row">
          <div className="flex items-center gap-6">
            <div className="rounded-full bg-amber-100 p-6">
              <Medal size={48} className="text-amber-500" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                Mejor Vendedor del Mes
              </span>
              <h2 className="text-4xl font-black italic text-slate-800">{mejor.mesero}</h2>
            </div>
          </div>
          <div className="mt-6 text-right md:mt-0">
            <p className="text-sm font-bold uppercase text-slate-600">Venta Acumulada</p>
            <p className="text-5xl font-black text-slate-900">{formatCurrency(mejor.total)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-100 p-8">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Award className="text-blue-600" aria-hidden="true" /> Tabla de Clasificación
            </h3>
          </div>
          <DataTable>
            <caption className="sr-only">Ranking de ventas por mesero</caption>
            <thead className="bg-slate-50">
              <tr className="text-xs font-black uppercase text-slate-600">
                <th className="p-6">Pos.</th>
                <th className="p-6">Mesero</th>
                <th className="p-6 text-center">Pedidos</th>
                <th className="p-6 text-right">Total Soles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ranking.map((mesero, index) => (
                <tr key={mesero.id || mesero.mesero} className="group transition-colors hover:bg-slate-50">
                  <td className="p-6 text-xl font-black italic text-slate-500 group-hover:text-blue-600">
                    #{index + 1}
                  </td>
                  <td className="p-6 font-bold text-slate-700">{mesero.mesero}</td>
                  <td className="p-6 text-center font-bold text-slate-500">{mesero.pedidos}</td>
                  <td className="p-6 text-right font-black text-slate-800">
                    {formatCurrency(mesero.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>

        <div className="space-y-6">
          <h3 className="px-4 font-bold text-slate-800">Calidad de Venta (Ticket Promedio)</h3>
          {ranking.map((mesero) => (
            <div
              key={`ticket-${mesero.id || mesero.mesero}`}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <TrendingUp size={20} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-600">{mesero.mesero}</p>
                  <p className="font-black italic text-slate-800">
                    {formatCurrency(mesero.ticketPromedio)}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs font-bold uppercase tracking-tighter text-slate-600">
                Promedio
                <br />
                por mesa
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ServerPagination
          page={reporte.page}
          totalPages={reporte.totalPages}
          basePath="/admin/reportes/personal"
        />
      </div>
    </div>
  );
}
