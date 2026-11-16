import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PrintButton } from "@/components/caja/PrintButton";
import { getServerSession } from "@/lib/auth/server-session";
import {
  CASH_PATHS,
  hasAnyCashPermission,
} from "@/lib/auth/cash-permissions";
import { getCuentaPedido } from "@/lib/cobros";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketPedidoPage({ params }: TicketPageProps) {
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
            No tienes permiso para imprimir el ticket.
          </p>
        </Card>
      </div>
    );
  }

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) notFound();

  const cuenta = await getCuentaPedido(pedidoId);
  if (!cuenta) notFound();

  if (cuenta.pedido.estadoPago !== "Pagado" && cuenta.pedido.estadoPago !== "Reembolsado") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Ticket no disponible</h1>
          <p className="mt-2 text-sm text-slate-600">
            El pedido aún no está pagado. Completa el cobro antes de imprimir el ticket.
          </p>
          <Link
            href={`/caja/pedidos/${pedidoId}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver a la cuenta
          </Link>
        </Card>
      </div>
    );
  }

  const pagosValidos = cuenta.pagos.filter((pago) => pago.estado !== "Anulado");
  const totalPorMetodo = pagosValidos.reduce<Record<string, number>>((acc, pago) => {
    acc[pago.metodo] = (acc[pago.metodo] ?? 0) + pago.monto + pago.propina;
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/caja/pedidos/${pedidoId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Volver a la cuenta
        </Link>
        <PrintButton />
      </div>

      <div className="print-area mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="border-b border-dashed border-slate-300 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
            <Receipt size={20} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black text-slate-900">Gestión Restaurante</h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Ticket interno
          </p>
          <p className="mt-2 text-sm font-bold text-slate-800">
            N° {cuenta.comprobante?.id ?? `T-${cuenta.pedido.id}`}
          </p>
          <p className="text-xs text-slate-500">{formatDateTime(cuenta.pedido.pagadoEn ?? cuenta.pedido.createdAt)}</p>
        </header>

        <section className="mt-4 space-y-1 text-sm">
          <p className="flex justify-between">
            <span className="text-slate-500">Mesa</span>
            <span className="font-semibold">{cuenta.pedido.mesaNumero}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Pedido</span>
            <span className="font-semibold">#{cuenta.pedido.id}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Mesero</span>
            <span className="font-semibold">{cuenta.pedido.meseroNombre ?? "—"}</span>
          </p>
        </section>

        <section className="mt-4 border-t border-dashed border-slate-300 pt-3">
          <table className="w-full text-sm" aria-label="Detalle del ticket">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1">Cant.</th>
                <th className="py-1">Producto</th>
                <th className="py-1 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {cuenta.detalles.map((detalle) => (
                <tr key={detalle.id}>
                  <td className="py-1">{detalle.cantidad}</td>
                  <td className="py-1">{detalle.nombre}</td>
                  <td className="py-1 text-right">{formatCurrency(detalle.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
          <p className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{formatCurrency(cuenta.pedido.subtotal)}</span>
          </p>
          {cuenta.pedido.descuentoTotal > 0 && (
            <p className="flex justify-between text-emerald-700">
              <span>Descuento</span>
              <span>-{formatCurrency(cuenta.pedido.descuentoTotal)}</span>
            </p>
          )}
          {cuenta.pedido.propinaTotal > 0 && (
            <p className="flex justify-between">
              <span className="text-slate-500">Propina</span>
              <span>{formatCurrency(cuenta.pedido.propinaTotal)}</span>
            </p>
          )}
          <p className="flex justify-between border-t border-slate-300 pt-2 text-base font-black">
            <span>Total</span>
            <span>{formatCurrency(cuenta.pedido.total)}</span>
          </p>
        </section>

        <section className="mt-3 border-t border-dashed border-slate-300 pt-3 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Pagos
          </p>
          {Object.entries(totalPorMetodo).map(([metodo, monto]) => (
            <p key={metodo} className="flex justify-between">
              <span className="text-slate-500">{metodo}</span>
              <span>{formatCurrency(monto)}</span>
            </p>
          ))}
          <p className="mt-2 flex justify-between font-bold">
            <span>Pagado</span>
            <span>{formatCurrency(cuenta.pedido.totalPagado)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-slate-500">Saldo</span>
            <span>{formatCurrency(cuenta.pedido.saldo)}</span>
          </p>
        </section>

        <footer className="mt-5 border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500">
          <p>Gracias por su visita</p>
          {pagosValidos[0]?.cajeroNombre && (
            <p className="mt-1">Cobrado por {pagosValidos[0].cajeroNombre}</p>
          )}
          <p className="mt-1">Ticket interno sin valor fiscal</p>
        </footer>
      </div>
    </div>
  );
}
