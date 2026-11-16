"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  Banknote,
  FileText,
  Lock,
  Percent,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/Field";
import { Input, selectBase, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toastSuccess, toastWarning } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import {
  calcularMontoItem,
  roundMoney,
  TIPOS_DESCUENTO,
  type CuentaPedidoDto,
  type PagoCajaDto,
} from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { can } from "./can";

interface CuentaPedidoClientProps {
  pedidoId: number;
  turnoActivoId: number | null;
  permissions: CashPermissions;
}

type ModoPago = "monto" | "persona" | "items";

function aplicacionesDesdeItems(
  items: Record<number, number>
): Array<{ pedidoDetalleId: number; cantidad: number }> {
  return Object.entries(items)
    .map(([id, cantidad]) => ({
      pedidoDetalleId: Number(id),
      cantidad: Math.floor(Number(cantidad)),
    }))
    .filter((item) => item.cantidad > 0);
}

export function CuentaPedidoClient({
  pedidoId,
  turnoActivoId,
  permissions,
}: CuentaPedidoClientProps) {
  const {
    data: cuenta,
    error,
    isLoading,
    mutate,
  } = useSWR<CuentaPedidoDto>(`/api/caja/pedidos/${pedidoId}/cuenta`);

  const [payOpen, setPayOpen] = useState(false);
  const [modoPago, setModoPago] = useState<ModoPago>("monto");
  const [monto, setMonto] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [propina, setPropina] = useState("");
  const [metodo, setMetodo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [codigoAutorizacion, setCodigoAutorizacion] = useState("");
  const [terminal, setTerminal] = useState("");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [itemsPago, setItemsPago] = useState<Record<number, number>>({});
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountTipo, setDiscountTipo] = useState<string>("Porcentaje");
  const [discountValor, setDiscountValor] = useState("");
  const [discountMotivo, setDiscountMotivo] = useState("");
  const [discountCupon, setDiscountCupon] = useState("");
  const [discounting, setDiscounting] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundPagoId, setRefundPagoId] = useState<number | null>(null);
  const [refundMonto, setRefundMonto] = useState("");
  const [refundPropina, setRefundPropina] = useState("");
  const [refundMotivo, setRefundMotivo] = useState("");
  const [refundItems, setRefundItems] = useState<Record<number, number>>({});
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<PagoCajaDto | null>(null);
  const [voidMotivo, setVoidMotivo] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const puedeCobrar = can(permissions, CASH_PATHS.turno, "CREAR");
  const puedeAprobar = can(permissions, CASH_PATHS.turno, "APROBAR");
  const puedeExportar =
    can(permissions, CASH_PATHS.turno, "EXPORTAR") ||
    can(permissions, CASH_PATHS.historial, "EXPORTAR");

  const resumenDevoluciones = useMemo(() => {
    const mapa = new Map<number, { monto: number; propina: number }>();
    for (const devolucion of cuenta?.devoluciones ?? []) {
      if (!devolucion.pagoId || devolucion.estado === "Anulada") continue;
      const actual = mapa.get(devolucion.pagoId) ?? { monto: 0, propina: 0 };
      actual.monto += devolucion.monto;
      actual.propina += devolucion.propina;
      mapa.set(devolucion.pagoId, actual);
    }
    return mapa;
  }, [cuenta?.devoluciones]);

  const devueltoPorDetalle = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const devolucion of cuenta?.devoluciones ?? []) {
      if (devolucion.estado === "Anulada") continue;
      for (const detalle of devolucion.detalles) {
        mapa.set(detalle.productoId, (mapa.get(detalle.productoId) ?? 0) + detalle.cantidad);
      }
    }
    return mapa;
  }, [cuenta?.devoluciones]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !cuenta) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-bold text-slate-800">No se pudo cargar la cuenta</p>
        <p className="mt-1 text-sm text-slate-600">
          Revisa la conexión o vuelve a iniciar sesión para actualizar tus permisos.
        </p>
        <Button className="mt-5" onClick={() => mutate()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  const pedido = cuenta.pedido;
  const pagado = pedido.estadoPago === "Pagado" || pedido.estadoPago === "Reembolsado";
  const puedeDescontar =
    puedeAprobar && !cuenta.descuento && pedido.totalPagado <= 0 && pedido.saldo > 0;
  const pagosDevolvibles = cuenta.pagos.filter(
    (pago) => pago.estado !== "Anulado" && pago.estado !== "Reembolsado"
  );
  const puedeDevolver = puedeAprobar && pagado && pagosDevolvibles.length > 0;

  const itemsPendientes = cuenta.detalles.filter(
    (detalle) => detalle.cantidadPendiente > 0
  );

  const abrirPago = () => {
    setModoPago("monto");
    setMonto(String(cuenta.pedido.saldo));
    setEtiqueta("");
    setPropina("");
    setMetodo("");
    setReferencia("");
    setCodigoAutorizacion("");
    setTerminal("");
    setMontoRecibido("");
    setItemsPago({});
    setPayError(null);
    setPayOpen(true);
  };

  const montoItems = roundMoney(
    cuenta.detalles.reduce((total, detalle) => {
      const cantidad = itemsPago[detalle.id] ?? 0;
      if (cantidad <= 0) return total;
      return (
        total +
        calcularMontoItem(
          detalle.precioUnitario,
          cantidad,
          pedido.subtotal,
          pedido.descuentoTotal
        )
      );
    }, 0)
  );

  const registrarPago = async () => {
    setPayError(null);
    if (!metodo) {
      setPayError("Selecciona un método de pago.");
      return;
    }
    if (modoPago === "persona" && etiqueta.trim().length === 0) {
      setPayError("Indica la persona o parte que está pagando.");
      return;
    }

    const body: Record<string, unknown> = {
      metodoPago: metodo,
      propina: Number(propina || 0),
      referencia: referencia.trim() || null,
      codigoAutorizacion: codigoAutorizacion.trim() || null,
      terminal: terminal.trim() || null,
      montoRecibido: montoRecibido.trim() ? Number(montoRecibido) : null,
      etiqueta: etiqueta.trim() || null,
    };

    if (modoPago === "items") {
      const aplicaciones = aplicacionesDesdeItems(itemsPago);
      if (aplicaciones.length === 0) {
        setPayError("Selecciona al menos un plato.");
        return;
      }
      body.aplicaciones = aplicaciones;
    } else {
      const valor = Number(monto);
      if (!Number.isFinite(valor) || valor <= 0) {
        setPayError("Ingresa un monto válido.");
        return;
      }
      body.monto = valor;
    }

    setPaying(true);
    try {
      await http.post(`/api/caja/pedidos/${pedidoId}/pagos`, body);
      toastSuccess(
        "Pago registrado",
        "El saldo de la cuenta fue actualizado."
      );
      setPayOpen(false);
      await mutate();
    } catch (err) {
      setPayError(getErrorMessage(err, "No se pudo registrar el pago."));
    } finally {
      setPaying(false);
    }
  };

  const aplicarDescuento = async () => {
    setDiscountError(null);
    if (discountMotivo.trim().length < 3) {
      setDiscountError("Describe el motivo del descuento.");
      return;
    }
    if (!discountCupon.trim()) {
      const valor = Number(discountValor);
      if (!Number.isFinite(valor) || valor <= 0) {
        setDiscountError("Ingresa un valor de descuento válido.");
        return;
      }
    }

    setDiscounting(true);
    try {
      await http.post(`/api/caja/pedidos/${pedidoId}/descuentos`, {
        tipo: discountTipo,
        valor: Number(discountValor || 0),
        motivo: discountMotivo.trim(),
        cuponCodigo: discountCupon.trim() || null,
      });
      toastSuccess("Descuento aplicado", "El total y el saldo fueron actualizados.");
      setDiscountOpen(false);
      await mutate();
    } catch (err) {
      setDiscountError(getErrorMessage(err, "No se pudo aplicar el descuento."));
    } finally {
      setDiscounting(false);
    }
  };

  const abrirDevolucion = () => {
    const pago = pagosDevolvibles[0];
    if (!pago) {
      toastWarning("Sin pagos", "No hay pagos disponibles para devolver.");
      return;
    }
    const devuelto = resumenDevoluciones.get(pago.id) ?? { monto: 0, propina: 0 };
    setRefundPagoId(pago.id);
    setRefundMonto(Math.max(0, roundMoney(pago.monto - devuelto.monto)).toFixed(2));
    setRefundPropina(
      Math.max(0, roundMoney(pago.propina - devuelto.propina)).toFixed(2)
    );
    setRefundMotivo("");
    setRefundItems({});
    setRefundError(null);
    setRefundOpen(true);
  };

  const seleccionarPagoDevolucion = (pagoId: number) => {
    const pago = cuenta.pagos.find((item) => item.id === pagoId);
    if (!pago) return;
    const devuelto = resumenDevoluciones.get(pago.id) ?? { monto: 0, propina: 0 };
    setRefundPagoId(pago.id);
    setRefundMonto(Math.max(0, roundMoney(pago.monto - devuelto.monto)).toFixed(2));
    setRefundPropina(
      Math.max(0, roundMoney(pago.propina - devuelto.propina)).toFixed(2)
    );
  };

  const registrarDevolucion = async () => {
    setRefundError(null);
    if (!refundPagoId) {
      setRefundError("Selecciona un pago.");
      return;
    }
    if (refundMotivo.trim().length < 3) {
      setRefundError("Describe el motivo de la devolución.");
      return;
    }

    const items = Object.entries(refundItems)
      .map(([detalleId, cantidad]) => ({
        pedidoDetalleId: Number(detalleId),
        cantidad: Math.floor(Number(cantidad)),
      }))
      .filter((item) => item.cantidad > 0);

    setRefunding(true);
    try {
      await http.post(`/api/caja/pedidos/${pedidoId}/devoluciones`, {
        pagoId: refundPagoId,
        monto: Number(refundMonto),
        propina: Number(refundPropina || 0),
        motivo: refundMotivo.trim(),
        items,
      });
      toastSuccess(
        "Devolución registrada",
        items.length > 0
          ? "Se repuso el stock de los ítems devueltos."
          : "La devolución quedó registrada en caja."
      );
      setRefundOpen(false);
      await mutate();
    } catch (err) {
      setRefundError(getErrorMessage(err, "No se pudo registrar la devolución."));
    } finally {
      setRefunding(false);
    }
  };

  const anularPago = async () => {
    if (!voidTarget) return;
    setVoidError(null);
    if (voidMotivo.trim().length < 3) {
      setVoidError("Describe el motivo de la anulación.");
      return;
    }

    setVoiding(true);
    try {
      await http.post(`/api/caja/pedidos/${pedidoId}/anular-pago`, {
        pagoId: voidTarget.id,
        motivo: voidMotivo.trim(),
      });
      toastSuccess("Pago anulado", "El saldo del pedido fue actualizado.");
      setVoidTarget(null);
      await mutate();
    } catch (err) {
      setVoidError(getErrorMessage(err, "No se pudo anular el pago."));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/caja"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="Volver a caja"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Mesa {pedido.mesaNumero} · Pedido #{pedido.id}
            </h1>
            <p className="text-sm text-slate-600">
              {pedido.meseroNombre ? `Mesero: ${pedido.meseroNombre}` : "Sin mesero asignado"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={pedido.estadoPago === "Pagado" ? "emerald" : pedido.estadoPago === "Parcial" ? "amber" : "neutral"}>
            {pedido.estadoPago}
          </Badge>
          {puedeExportar && cuenta.comprobante && (
            <Link
              href={`/caja/pedidos/${pedidoId}/ticket`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FileText size={17} aria-hidden="true" />
              Ticket
            </Link>
          )}
          {puedeDescontar && (
            <Button variant="outline" onClick={() => setDiscountOpen(true)}>
              <Percent size={17} aria-hidden="true" />
              Descuento
            </Button>
          )}
          {puedeDevolver && (
            <Button variant="outline" onClick={abrirDevolucion}>
              <RotateCcw size={17} aria-hidden="true" />
              Devolución
            </Button>
          )}
          {puedeCobrar && pedido.saldo > 0 && (
            <Button onClick={abrirPago}>
              <Banknote size={17} aria-hidden="true" />
              Registrar pago
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Subtotal</p>
          <p className="mt-1 text-lg font-black text-slate-800">{formatCurrency(pedido.subtotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Descuento</p>
          <p className="mt-1 text-lg font-black text-slate-800">{formatCurrency(pedido.descuentoTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Propina</p>
          <p className="mt-1 text-lg font-black text-slate-800">{formatCurrency(pedido.propinaTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total</p>
          <p className="mt-1 text-lg font-black text-slate-800">{formatCurrency(pedido.total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pagado</p>
          <p className="mt-1 text-lg font-black text-emerald-700">{formatCurrency(pedido.totalPagado)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Saldo</p>
          <p className="mt-1 text-lg font-black text-blue-700">{formatCurrency(pedido.saldo)}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-800">Consumo</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" aria-label="Platos de la cuenta">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Plato</th>
                <th className="px-5 py-3 text-right">Cantidad</th>
                <th className="px-5 py-3 text-right">Pagado</th>
                <th className="px-5 py-3 text-right">Pendiente</th>
                <th className="px-5 py-3 text-right">Precio</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cuenta.detalles.map((detalle) => (
                <tr key={detalle.id}>
                  <td className="px-5 py-3 font-semibold text-slate-800">
                    {detalle.nombre}
                    {detalle.estado && (
                      <Badge className="ml-2" tone={detalle.estado === "Listo" ? "emerald" : "amber"}>
                        {detalle.estado}
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">{detalle.cantidad}</td>
                  <td className="px-5 py-3 text-right text-emerald-700">{detalle.cantidadPagada}</td>
                  <td className="px-5 py-3 text-right font-semibold text-blue-700">{detalle.cantidadPendiente}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(detalle.precioUnitario)}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatCurrency(detalle.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-800">Pagos</h2>
        </div>
        {cuenta.pagos.length === 0 ? (
          <EmptyState icon={Banknote} title="Sin pagos" description="Registra el primer pago de esta cuenta." />
        ) : (
          <div className="divide-y divide-slate-100">
            {cuenta.pagos.map((pago) => (
              <div key={pago.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-800">
                      {formatCurrency(pago.monto)}
                      {pago.propina > 0 && ` + ${formatCurrency(pago.propina)} propina`}
                    </p>
                    <Badge tone={pago.estado === "Conciliado" ? "emerald" : pago.estado === "Reembolsado" ? "purple" : pago.estado === "Anulado" ? "rose" : "amber"}>
                      {pago.estado}
                    </Badge>
                    {pago.etiqueta && <Badge tone="blue">{pago.etiqueta}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {pago.metodo} · {pago.cajeroNombre ?? "—"} · {formatDateTime(pago.createdAt)}
                    {pago.referencia ? ` · Ref. ${pago.referencia}` : ""}
                    {pago.codigoAutorizacion ? ` · Aut. ${pago.codigoAutorizacion}` : ""}
                  </p>
                  {pago.aplicaciones.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {pago.aplicaciones
                        .map((aplicacion) => `${aplicacion.cantidad}x ${aplicacion.productoNombre}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                {puedeAprobar &&
                  turnoActivoId !== null &&
                  pago.turnoId === turnoActivoId &&
                  pago.estado !== "Anulado" &&
                  pago.estado !== "Reembolsado" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVoidTarget(pago);
                      setVoidMotivo("");
                      setVoidError(null);
                    }}
                  >
                    <Lock size={15} aria-hidden="true" />
                    Anular
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {cuenta.descuento && (
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Percent size={18} className="text-purple-600" aria-hidden="true" />
            <h2 className="font-bold text-slate-800">Descuento aplicado</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {cuenta.descuento.tipo === "Porcentaje"
              ? `${cuenta.descuento.valor}%`
              : formatCurrency(cuenta.descuento.valor)}{" "}
            · {formatCurrency(cuenta.descuento.montoAplicado)} · {cuenta.descuento.motivo}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Autorizado por {cuenta.descuento.autorizadoPorNombre ?? "—"}
          </p>
        </Card>
      )}

      {cuenta.devoluciones.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-800">Devoluciones</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {cuenta.devoluciones.map((devolucion) => (
              <div key={devolucion.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {formatCurrency(devolucion.monto)}
                    {devolucion.propina > 0 && ` + ${formatCurrency(devolucion.propina)} propina`}
                  </p>
                  <Badge tone={devolucion.estado === "Conciliada" ? "emerald" : devolucion.estado === "Anulada" ? "rose" : "amber"}>
                    {devolucion.estado}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {devolucion.metodo} · {devolucion.motivo} · {devolucion.cajeroNombre}
                </p>
                {devolucion.detalles.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    {devolucion.detalles
                      .map((detalle) => `${detalle.cantidad}x ${detalle.productoNombre}`)
                      .join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar pago"
        description={`Saldo actual: ${formatCurrency(pedido.saldo)}`}
        size="lg"
        closeOnBackdrop={!paying}
        showCloseButton={!paying}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
              Cancelar
            </Button>
            <Button variant="success" onClick={registrarPago} loading={paying}>
              Confirmar pago
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Forma de pago">
            {[
              { id: "monto" as const, label: "Monto" },
              { id: "persona" as const, label: "Persona / parte" },
              { id: "items" as const, label: "Por ítems" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={modoPago === item.id}
                onClick={() => setModoPago(item.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  modoPago === item.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {modoPago === "items" ? (
            <div className="space-y-2">
              {itemsPendientes.length === 0 ? (
                <p className="text-sm text-slate-600">No hay cantidades pendientes.</p>
              ) : (
                itemsPendientes.map((detalle) => (
                  <div key={detalle.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{detalle.nombre}</p>
                      <p className="text-xs text-slate-500">
                        Pendientes: {detalle.cantidadPendiente} · {formatCurrency(detalle.precioUnitario)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={detalle.cantidadPendiente}
                      step="1"
                      value={itemsPago[detalle.id] ?? ""}
                      onChange={(event) => {
                        const value = Math.min(
                          detalle.cantidadPendiente,
                          Math.max(0, Math.floor(Number(event.target.value) || 0))
                        );
                        setItemsPago((prev) => ({ ...prev, [detalle.id]: value }));
                      }}
                      className="w-24 text-right"
                      aria-label={`Cantidad de ${detalle.nombre}`}
                      disabled={paying}
                    />
                  </div>
                ))
              )}
              <p className="text-sm font-semibold text-slate-700">
                Monto calculado: {formatCurrency(montoItems)}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pago-monto" required>
                  Monto
                </Label>
                <Input
                  id="pago-monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  onChange={(event) => setMonto(event.target.value)}
                  disabled={paying}
                />
              </div>
              {modoPago === "persona" && (
                <div>
                  <Label htmlFor="pago-etiqueta" required>
                    Persona / parte
                  </Label>
                  <Input
                    id="pago-etiqueta"
                    value={etiqueta}
                    onChange={(event) => setEtiqueta(event.target.value)}
                    placeholder="Persona 1, parte A..."
                    maxLength={50}
                    disabled={paying}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pago-metodo" required>
                Método
              </Label>
              <select
                id="pago-metodo"
                className={selectBase}
                value={metodo}
                onChange={(event) => setMetodo(event.target.value)}
                disabled={paying}
              >
                <option value="">Selecciona método</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta / POS</option>
                <option value="Yape/Plin">Yape / Plin</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pago-propina">Propina</Label>
              <Input
                id="pago-propina"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={propina}
                onChange={(event) => setPropina(event.target.value)}
                placeholder="0.00"
                disabled={paying}
              />
            </div>
          </div>

          {metodo === "Efectivo" && (
            <div>
              <Label htmlFor="pago-recibido">Efectivo recibido</Label>
              <Input
                id="pago-recibido"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={montoRecibido}
                onChange={(event) => setMontoRecibido(event.target.value)}
                placeholder="Opcional; se calcula el cambio"
                disabled={paying}
              />
            </div>
          )}

          {metodo && metodo !== "Efectivo" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pago-referencia">Referencia</Label>
                <Input
                  id="pago-referencia"
                  value={referencia}
                  onChange={(event) => setReferencia(event.target.value)}
                  maxLength={100}
                  disabled={paying}
                />
              </div>
              <div>
                <Label htmlFor="pago-autorizacion">Código de autorización</Label>
                <Input
                  id="pago-autorizacion"
                  value={codigoAutorizacion}
                  onChange={(event) => setCodigoAutorizacion(event.target.value)}
                  maxLength={100}
                  disabled={paying}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="pago-terminal">Terminal</Label>
                <Input
                  id="pago-terminal"
                  value={terminal}
                  onChange={(event) => setTerminal(event.target.value)}
                  maxLength={50}
                  disabled={paying}
                />
              </div>
            </div>
          )}

          {payError && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {payError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        title="Aplicar descuento"
        description={`Subtotal: ${formatCurrency(pedido.subtotal)}`}
        closeOnBackdrop={!discounting}
        showCloseButton={!discounting}
        footer={
          <>
            <Button variant="outline" onClick={() => setDiscountOpen(false)} disabled={discounting}>
              Cancelar
            </Button>
            <Button onClick={aplicarDescuento} loading={discounting}>
              Aplicar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="descuento-tipo">Tipo</Label>
              <select
                id="descuento-tipo"
                className={selectBase}
                value={discountTipo}
                onChange={(event) => setDiscountTipo(event.target.value)}
                disabled={discounting}
              >
                {TIPOS_DESCUENTO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="descuento-valor">Valor</Label>
              <Input
                id="descuento-valor"
                type="number"
                min="0.01"
                step="0.01"
                value={discountValor}
                onChange={(event) => setDiscountValor(event.target.value)}
                disabled={discounting || Boolean(discountCupon)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="descuento-cupon">Cupón (opcional)</Label>
            <Input
              id="descuento-cupon"
              value={discountCupon}
              onChange={(event) => setDiscountCupon(event.target.value.toUpperCase())}
              placeholder="BIENVENIDO10"
              disabled={discounting}
            />
            <p className="mt-1 text-xs text-slate-500">
              Si usas un cupón, su tipo y valor reemplazan los campos manuales.
            </p>
          </div>
          <div>
            <Label htmlFor="descuento-motivo" required>
              Motivo
            </Label>
            <Textarea
              id="descuento-motivo"
              value={discountMotivo}
              onChange={(event) => setDiscountMotivo(event.target.value)}
              maxLength={300}
              disabled={discounting}
            />
          </div>
          {discountError && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {discountError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Registrar devolución"
        description="La devolución se registra en el turno actual."
        size="lg"
        closeOnBackdrop={!refunding}
        showCloseButton={!refunding}
        footer={
          <>
            <Button variant="outline" onClick={() => setRefundOpen(false)} disabled={refunding}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={registrarDevolucion} loading={refunding}>
              Registrar devolución
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="devolucion-pago" required>
              Pago a devolver
            </Label>
            <select
              id="devolucion-pago"
              className={selectBase}
              value={refundPagoId ?? ""}
              onChange={(event) => seleccionarPagoDevolucion(Number(event.target.value))}
              disabled={refunding}
            >
              {pagosDevolvibles.map((pago) => (
                <option key={pago.id} value={pago.id}>
                  {formatCurrency(pago.monto)} · {pago.metodo} · {pago.etiqueta ?? `Pago #${pago.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="devolucion-monto">Monto a devolver</Label>
              <Input
                id="devolucion-monto"
                type="number"
                min="0"
                step="0.01"
                value={refundMonto}
                onChange={(event) => setRefundMonto(event.target.value)}
                disabled={refunding}
              />
            </div>
            <div>
              <Label htmlFor="devolucion-propina">Propina a devolver</Label>
              <Input
                id="devolucion-propina"
                type="number"
                min="0"
                step="0.01"
                value={refundPropina}
                onChange={(event) => setRefundPropina(event.target.value)}
                disabled={refunding}
              />
            </div>
          </div>

          <div>
            <Label>Ítems devueltos (para reponer stock)</Label>
            <div className="mt-2 space-y-2">
              {cuenta.detalles.map((detalle) => {
                const devuelto = devueltoPorDetalle.get(detalle.productoId) ?? 0;
                const disponible = Math.max(0, detalle.cantidad - devuelto);
                return (
                  <div key={detalle.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{detalle.nombre}</p>
                      <p className="text-xs text-slate-500">
                        Vendidos: {detalle.cantidad} · Disponibles para devolver: {disponible}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={disponible}
                      step="1"
                      value={refundItems[detalle.id] ?? ""}
                      onChange={(event) => {
                        const value = Math.min(
                          disponible,
                          Math.max(0, Math.floor(Number(event.target.value) || 0))
                        );
                        setRefundItems((prev) => ({ ...prev, [detalle.id]: value }));
                      }}
                      className="w-24 text-right"
                      aria-label={`Cantidad devuelta de ${detalle.nombre}`}
                      disabled={refunding || disponible === 0}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Label htmlFor="devolucion-motivo" required>
              Motivo
            </Label>
            <Textarea
              id="devolucion-motivo"
              value={refundMotivo}
              onChange={(event) => setRefundMotivo(event.target.value)}
              maxLength={500}
              disabled={refunding}
            />
          </div>

          {refundError && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {refundError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title="Anular pago"
        description={
          voidTarget
            ? `Se anulará un pago de ${formatCurrency(voidTarget.monto + voidTarget.propina)}.`
            : undefined
        }
        closeOnBackdrop={!voiding}
        showCloseButton={!voiding}
        footer={
          <>
            <Button variant="outline" onClick={() => setVoidTarget(null)} disabled={voiding}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={anularPago} loading={voiding}>
              Anular pago
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="anular-motivo" required>
            Motivo
          </Label>
          <Textarea
            id="anular-motivo"
            value={voidMotivo}
            onChange={(event) => setVoidMotivo(event.target.value)}
            maxLength={500}
            disabled={voiding}
          />
          {voidError && (
            <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
              {voidError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
