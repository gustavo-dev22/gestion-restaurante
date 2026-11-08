import { Puzzle, Star, Trash2, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { DataTable } from "@/components/ui/DataTable";
import { getIngenieriaReportCached } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getIcon(categoria: string) {
  switch (categoria) {
    case "ESTRELLA":
      return <Star className="text-amber-500" aria-hidden="true" />;
    case "CABALLO":
      return <Zap className="text-blue-500" aria-hidden="true" />;
    case "ROMPECABEZAS":
      return <Puzzle className="text-purple-500" aria-hidden="true" />;
    default:
      return <Trash2 className="text-slate-400" aria-hidden="true" />;
  }
}

function getColor(categoria: string) {
  switch (categoria) {
    case "ESTRELLA":
      return "bg-amber-50 border-amber-200";
    case "CABALLO":
      return "bg-blue-50 border-blue-200";
    case "ROMPECABEZAS":
      return "bg-purple-50 border-purple-200";
    default:
      return "bg-slate-50 border-slate-200";
  }
}

export default async function IngenieriaMenuPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page) || 1;
  const reporte = await getIngenieriaReportCached(page);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ingeniería de Menú"
        description="Análisis de popularidad vs rentabilidad (Matriz Boston)"
      />

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {["ESTRELLA", "CABALLO", "ROMPECABEZAS", "PERRO"].map((categoria) => (
          <div key={categoria} className={`rounded-2xl border-2 p-6 ${getColor(categoria)}`}>
            <div className="mb-2 flex items-center gap-3">
              {getIcon(categoria)}
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">
                {categoria}S
              </span>
            </div>
            <p className="text-2xl font-black text-slate-800">
              {reporte.conteos[categoria] ?? 0}
            </p>
            <p className="mt-1 text-xs font-bold uppercase text-slate-600">Platos identificados</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable>
          <caption className="sr-only">Clasificación de platos por popularidad y rentabilidad</caption>
          <thead className="border-b-2 border-slate-100 bg-slate-50">
            <tr>
              <th className="p-6 text-xs font-black uppercase text-slate-600">Plato</th>
              <th className="p-6 text-center text-xs font-black uppercase text-slate-600">Ventas (Cant)</th>
              <th className="p-6 text-center text-xs font-black uppercase text-slate-600">Margen Est.</th>
              <th className="p-6 text-xs font-black uppercase text-slate-600">Clasificación</th>
              <th className="p-6 text-xs font-black uppercase text-slate-600">Acción Sugerida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {reporte.matriz.map((plato) => (
              <tr key={plato.id} className="transition-colors hover:bg-slate-50">
                <td className="p-6 font-bold text-slate-700">{plato.nombre}</td>
                <td className="p-6 text-center font-mono font-bold text-slate-500">{plato.cantidad}</td>
                <td className="p-6 text-center font-black text-emerald-600">
                  {formatCurrency(plato.margen)}
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-2">
                    {getIcon(plato.clasificacion)}
                    <span className="text-xs font-black">{plato.clasificacion}</span>
                  </div>
                </td>
                <td className="p-6">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {plato.clasificacion === "ESTRELLA" && "Promocionar más"}
                    {plato.clasificacion === "CABALLO" && "Revisar costos/receta"}
                    {plato.clasificacion === "ROMPECABEZAS" && "Mejorar visibilidad"}
                    {plato.clasificacion === "PERRO" && "Evaluar retiro"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <ServerPagination
          page={reporte.page}
          totalPages={reporte.totalPages}
          basePath="/admin/reportes/ingenieria"
        />
      </div>
    </div>
  );
}
