import Link from "next/link";
import { FileText, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServerPagination } from "@/components/ui/ServerPagination";
import { CASH_PATHS, hasAnyCashPermission, hasCashPermission } from "@/lib/auth/cash-permissions";
import { getServerSession } from "@/lib/auth/server-session";
import { getHistorialTurnos } from "@/lib/caja";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface HistorialPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function HistorialCajaPage({ searchParams }: HistorialPageProps) {
  const session = await getServerSession();

  if (!session?.cashPermissions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Permisos de caja desactualizados</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cierra sesión desde el menú y vuelve a iniciar sesión para actualizar tus permisos.
          </p>
        </Card>
      </div>
    );
  }

  if (!hasCashPermission(session, CASH_PATHS.historial, "LISTAR")) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
          <p className="mt-2 text-sm text-slate-600">
            No tienes el permiso LISTAR para el historial de caja.
          </p>
        </Card>
      </div>
    );
  }

  const { page } = await searchParams;
  const historial = await getHistorialTurnos(Number(page) || 1);
  const puedeExportar = hasAnyCashPermission(
    session,
    [CASH_PATHS.turno, CASH_PATHS.historial],
    "EXPORTAR"
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Historial de caja"
        description="Turnos cerrados, arqueos y diferencias."
      />

      <Card className="overflow-hidden">
        {historial.items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Sin turnos cerrados"
            description="Cuando cierres el primer turno aparecerá en este historial."
          />
        ) : (
          <>
            <DataTable label="Historial de turnos de caja">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Turno</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Cajero</th>
                  <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">Apertura / cierre</th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Ventas</th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Esperado</th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Contado</th>
                  <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Diferencia</th>
                  <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600">Reporte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historial.items.map((turno) => (
                  <tr key={turno.id}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800">#{turno.id}</p>
                      <Badge tone={turno.estado === "Cerrado" ? "emerald" : "amber"}>
                        {turno.estado}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700">{turno.cajeroNombre}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      <p>{formatDateTime(turno.abiertoEn)}</p>
                      <p>{turno.cerradoEn ? formatDateTime(turno.cerradoEn) : "—"}</p>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-800">
                      {formatCurrency(turno.totalVentas)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      {formatCurrency(turno.efectivoEsperado ?? 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-700">
                      {turno.efectivoContado === null ? "—" : formatCurrency(turno.efectivoContado)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={
                          turno.diferencia && Math.abs(turno.diferencia) >= 0.01
                            ? "font-bold text-rose-600"
                            : "font-semibold text-emerald-600"
                        }
                      >
                        {turno.diferencia === null ? "—" : formatCurrency(turno.diferencia)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {puedeExportar ? (
                        <Link
                          href={`/caja/turnos/${turno.id}/reporte`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <FileText size={16} aria-hidden="true" />
                          Ver
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">Sin permiso</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <ServerPagination
              page={historial.page}
              totalPages={historial.totalPages}
              basePath="/caja/historial"
            />
          </>
        )}
      </Card>
    </div>
  );
}
