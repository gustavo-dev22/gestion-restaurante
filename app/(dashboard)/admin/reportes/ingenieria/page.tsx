import { HelpCircle, PackageX, Puzzle, Star, Trash2, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { DataTable } from "@/components/ui/DataTable";
import { getIngenieriaReportCached } from "@/lib/reports";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CATEGORIAS = [
  "ESTRELLA",
  "CABALLO",
  "ROMPECABEZAS",
  "PERRO",
  "SIN_COSTO",
  "SIN_VENTAS",
] as const;

const LABELS: Record<string, string> = {
  ESTRELLA: "Estrellas",
  CABALLO: "Caballos",
  ROMPECABEZAS: "Rompecabezas",
  PERRO: "Perros",
  SIN_COSTO: "Sin costo real",
  SIN_VENTAS: "Sin ventas",
};

function getIcon(categoria: string) {
  switch (categoria) {
    case "ESTRELLA":
      return <Star className="text-amber-500" aria-hidden="true" />;
    case "CABALLO":
      return <Zap className="text-blue-500" aria-hidden="true" />;
    case "ROMPECABEZAS":
      return <Puzzle className="text-purple-500" aria-hidden="true" />;
    case "SIN_COSTO":
      return <HelpCircle className="text-orange-500" aria-hidden="true" />;
    case "SIN_VENTAS":
      return <PackageX className="text-slate-400" aria-hidden="true" />;
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
    case "SIN_COSTO":
      return "bg-orange-50 border-orange-200";
    case "SIN_VENTAS":
      return "bg-slate-50 border-slate-200";
    default:
      return "bg-slate-50 border-slate-200";
  }
}

function getAction(categoria: string) {
  switch (categoria) {
    case "ESTRELLA":
      return "Mantener y promocionar";
    case "CABALLO":
      return "Revisar costo, porción o precio";
    case "ROMPECABEZAS":
      return "Mejorar visibilidad y recomendación";
    case "PERRO":
      return "Reformular o evaluar retiro";
    case "SIN_COSTO":
      return "Completar receta y costo real";
    default:
      return "Sin ventas en el período";
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
        description="Popularidad vs margen real. Solo ventas pagadas o cerradas."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Ingreso vendido</p>
          <p className="mt-1 text-2xl font-black text-slate-800">
            {formatCurrency(reporte.totalIngreso)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Costo real</p>
          <p className="mt-1 text-2xl font-black text-slate-800">
            {formatCurrency(reporte.totalCosto)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-emerald-700">Margen de contribución</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">
            {formatCurrency(reporte.totalMargen)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Unidades vendidas</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{reporte.totalUnidades}</p>
        </div>
      </div>

      {!reporte.costoCompleto && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-800">
          Hay productos vendidos sin costo real registrado. Aparecen como <b>Sin costo real</b>.
          Para obtener márgenes correctos, completa sus recetas y registra compras.
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {CATEGORIAS.map((categoria) => (
          <div key={categoria} className={`rounded-2xl border-2 p-5 ${getColor(categoria)}`}>
            <div className="mb-2 flex items-center gap-2">
              {getIcon(categoria)}
              <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                {LABELS[categoria]}
              </span>
            </div>
            <p className="text-2xl font-black text-slate-800">
              {reporte.conteos[categoria] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <DataTable label="Clasificación de platos por popularidad y margen real" minWidthClass="min-w-[1200px]">
          <thead className="border-b-2 border-slate-100 bg-slate-50">
            <tr>
              <th className="p-4 text-xs font-black uppercase text-slate-600">Plato</th>
              <th className="p-4 text-center text-xs font-black uppercase text-slate-600">Ventas</th>
              <th className="p-4 text-right text-xs font-black uppercase text-slate-600">Ingreso</th>
              <th className="p-4 text-right text-xs font-black uppercase text-slate-600">Costo real</th>
              <th className="p-4 text-right text-xs font-black uppercase text-slate-600">Margen unit.</th>
              <th className="p-4 text-right text-xs font-black uppercase text-slate-600">Margen total</th>
              <th className="p-4 text-right text-xs font-black uppercase text-slate-600">Mix</th>
              <th className="p-4 text-xs font-black uppercase text-slate-600">Clasificación</th>
              <th className="p-4 text-xs font-black uppercase text-slate-600">Acción sugerida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {reporte.matriz.map((plato) => (
              <tr key={plato.id} className="transition-colors hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-700">{plato.nombre}</td>
                <td className="p-4 text-center font-mono font-bold text-slate-600">
                  {plato.cantidad}
                </td>
                <td className="p-4 text-right font-semibold text-slate-700">
                  {formatCurrency(plato.ingreso)}
                </td>
                <td className="p-4 text-right text-slate-700">
                  {plato.costo === null ? "Sin costo" : formatCurrency(plato.costo)}
                </td>
                <td className="p-4 text-right font-black text-emerald-600">
                  {plato.margenUnitario === null
                    ? "—"
                    : formatCurrency(plato.margenUnitario)}
                </td>
                <td className="p-4 text-right font-semibold text-slate-700">
                  {plato.margenTotal === null ? "—" : formatCurrency(plato.margenTotal)}
                </td>
                <td className="p-4 text-right text-sm text-slate-600">
                  {(plato.mix * 100).toFixed(1)}%
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {getIcon(plato.clasificacion)}
                    <span className="text-xs font-black">{LABELS[plato.clasificacion]}</span>
                  </div>
                </td>
                <td className="p-4 text-xs font-semibold text-slate-600">
                  {getAction(plato.clasificacion)}
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
