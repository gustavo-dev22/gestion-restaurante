import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/caja/PrintButton";
import { CASH_PATHS, hasAnyCashPermission } from "@/lib/auth/cash-permissions";
import { getServerSession } from "@/lib/auth/server-session";
import { getReporteTurno } from "@/lib/caja";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ReportePageProps {
  params: Promise<{ id: string }>;
}

export default async function ReporteCajaPage({ params }: ReportePageProps) {
  const session = await getServerSession();

  if (!session?.cashPermissions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Permisos desactualizados</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cierra sesión y vuelve a entrar para actualizar tus permisos.
          </p>
        </Card>
      </div>
    );
  }

  if (
    !hasAnyCashPermission(
      session,
      [CASH_PATHS.turno, CASH_PATHS.historial],
      "EXPORTAR"
    )
  ) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
          <p className="mt-2 text-sm text-slate-600">
            No tienes permiso para imprimir reportes de caja.
          </p>
        </Card>
      </div>
    );
  }

  const { id } = await params;
  const turnoId = Number(id);
  if (!Number.isInteger(turnoId) || turnoId <= 0) notFound();

  const reporte = await getReporteTurno(turnoId);
  if (!reporte) notFound();

  const { turno, resumen, pagos, movimientos } = reporte;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/caja/historial"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Volver al historial
        </Link>
        <PrintButton />
      </div>

      <div className="print-area mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="border-b border-slate-200 pb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Wallet size={24} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Reporte de cierre de caja</h1>
          <p className="mt-1 text-sm text-slate-600">Gestión Restaurante</p>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Datos del turno">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Turno</p>
            <p className="mt-1 font-bold text-slate-800">#{turno.id}</p>
            <p className="text-sm text-slate-600">Cajero: {turno.cajeroNombre}</p>
            <p className="text-sm text-slate-600">
              Cierre por: {turno.cerradoPorNombre ?? "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Fechas</p>
            <p className="mt-1 text-sm text-slate-600">
              Apertura: {formatDateTime(turno.abiertoEn)}
            </p>
            <p className="text-sm text-slate-600">
              Cierre: {turno.cerradoEn ? formatDateTime(turno.cerradoEn) : "—"}
            </p>
            <p className="text-sm text-slate-600">Estado: {turno.estado}</p>
          </div>
        </section>

        <section className="mt-6" aria-label="Resumen de ventas">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            Ventas por método
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Efectivo</p>
              <p className="font-bold text-slate-800">{formatCurrency(resumen.totalEfectivo)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Tarjeta</p>
              <p className="font-bold text-slate-800">{formatCurrency(resumen.totalTarjeta)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Billeteras</p>
              <p className="font-bold text-slate-800">{formatCurrency(resumen.totalBilleteras)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">Total ventas</p>
              <p className="font-bold text-slate-800">{formatCurrency(resumen.totalVentas)}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Arqueo">
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
              Movimientos
            </h2>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Fondo inicial</span>
              <span className="font-semibold text-slate-800">{formatCurrency(turno.fondoInicial)}</span>
            </p>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Ingresos</span>
              <span className="font-semibold text-slate-800">{formatCurrency(resumen.totalIngresos)}</span>
            </p>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Retiros</span>
              <span className="font-semibold text-slate-800">-{formatCurrency(resumen.totalRetiros)}</span>
            </p>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Gastos</span>
              <span className="font-semibold text-slate-800">-{formatCurrency(resumen.totalGastos)}</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
              Arqueo de efectivo
            </h2>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Efectivo esperado</span>
              <span className="font-semibold text-slate-800">{formatCurrency(turno.efectivoEsperado ?? resumen.efectivoEsperado)}</span>
            </p>
            <p className="flex justify-between text-sm text-slate-600">
              <span>Efectivo contado</span>
              <span className="font-semibold text-slate-800">
                {turno.efectivoContado === null ? "—" : formatCurrency(turno.efectivoContado)}
              </span>
            </p>
            <p className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
              <span className="font-semibold text-slate-700">Diferencia</span>
              <span className={turno.diferencia && Math.abs(turno.diferencia) >= 0.01 ? "font-black text-rose-600" : "font-black text-emerald-600"}>
                {turno.diferencia === null ? "—" : formatCurrency(turno.diferencia)}
              </span>
            </p>
            {turno.justificacion && (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold">Justificación:</span> {turno.justificacion}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6" aria-label="Pagos del turno">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            Pagos registrados
          </h2>
          {pagos.length === 0 ? (
            <p className="text-sm text-slate-600">Sin pagos.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Pagos registrados en el turno">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Pedido</th>
                  <th className="py-2 pr-2">Mesa</th>
                  <th className="py-2 pr-2">Método</th>
                  <th className="py-2 pr-2">Cobrado por</th>
                  <th className="py-2 pr-2 text-right">Monto</th>
                  <th className="py-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pago) => (
                  <tr key={pago.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">#{pago.pedidoId}</td>
                    <td className="py-2 pr-2">{pago.mesaNumero}</td>
                    <td className="py-2 pr-2">{pago.metodo}</td>
                    <td className="py-2 pr-2">{pago.cajeroNombre ?? "—"}</td>
                    <td className="py-2 pr-2 text-right font-semibold">{formatCurrency(pago.monto)}</td>
                    <td className="py-2 text-right">{pago.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-6" aria-label="Movimientos de caja">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">
            Movimientos de caja
          </h2>
          {movimientos.length === 0 ? (
            <p className="text-sm text-slate-600">Sin movimientos.</p>
          ) : (
            <table className="w-full text-sm" aria-label="Movimientos de caja del turno">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Motivo</th>
                  <th className="py-2 pr-2">Usuario</th>
                  <th className="py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{movimiento.tipo}</td>
                    <td className="py-2 pr-2">{movimiento.motivo}</td>
                    <td className="py-2 pr-2">{movimiento.usuarioNombre}</td>
                    <td className="py-2 text-right font-semibold">{formatCurrency(movimiento.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-10 grid grid-cols-2 gap-10 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
          <div>
            <div className="mx-auto mb-2 h-px w-40 bg-slate-400" />
            Firma del cajero
          </div>
          <div>
            <div className="mx-auto mb-2 h-px w-40 bg-slate-400" />
            Firma del supervisor
          </div>
        </footer>
      </div>
    </div>
  );
}
