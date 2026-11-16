import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CajaError } from "@/lib/caja-errors";
import {
  calcularMontoItem,
  esMetodoPago,
  roundMoney,
} from "@/lib/caja-types";
import type { SessionPayload } from "@/lib/auth/session";
import { actorFromSession, auditLog, type AuditContext } from "@/lib/audit";

export interface PagoAplicacionInput {
  pedidoDetalleId: number;
  cantidad: number;
}

export interface RegistrarPagoInput {
  actor: SessionPayload;
  pedidoId: number;
  metodo: string;
  monto?: number;
  propina?: number;
  referencia?: string | null;
  codigoAutorizacion?: string | null;
  terminal?: string | null;
  montoRecibido?: number | null;
  etiqueta?: string | null;
  aplicaciones?: PagoAplicacionInput[];
  allowAnyOrder?: boolean;
  fullBalanceOnly?: boolean;
  audit?: AuditContext;
}

export interface RegistrarPagoResult {
  pagoId: number;
  turnoId: number;
  monto: number;
  propina: number;
  total: number;
  totalPagado: number;
  saldo: number;
  cambio: number | null;
  metodo: string;
}

export async function registrarPago({
  actor,
  pedidoId,
  metodo,
  monto,
  propina,
  referencia,
  codigoAutorizacion,
  terminal,
  montoRecibido,
  etiqueta,
  aplicaciones,
  allowAnyOrder = false,
  fullBalanceOnly = false,
  audit,
}: RegistrarPagoInput): Promise<RegistrarPagoResult> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    throw new CajaError(400, "PEDIDO_INVALIDO", "El pedido es inválido.");
  }

  if (!esMetodoPago(metodo)) {
    throw new CajaError(400, "METODO_INVALIDO", "El método de pago es inválido.");
  }

  const propinaInput = roundMoney(Number(propina ?? 0));
  if (!Number.isFinite(propinaInput) || propinaInput < 0) {
    throw new CajaError(400, "PROPINA_INVALIDA", "La propina debe ser mayor o igual a cero.");
  }

  if (fullBalanceOnly && propinaInput > 0) {
    throw new CajaError(
      400,
      "PROPINA_NO_PERMITIDA",
      "El mesero solo registra el saldo completo, sin propina."
    );
  }

  const ref = String(referencia ?? "").trim().slice(0, 100);
  const autorizacion = String(codigoAutorizacion ?? "").trim().slice(0, 100);
  const terminalInput = String(terminal ?? "").trim().slice(0, 50);
  const etiquetaInput = String(etiqueta ?? "").trim().slice(0, 50);
  const aplicacionesInput = Array.isArray(aplicaciones) ? aplicaciones : [];

  if (fullBalanceOnly && aplicacionesInput.length > 0) {
    throw new CajaError(
      400,
      "DIVISION_NO_PERMITIDA",
      "La división de cuenta solo se realiza desde Caja."
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const turno = await tx.turnoCaja.findFirst({
        where: { estado: "Abierto" },
        orderBy: { abiertoEn: "desc" },
        select: { id: true },
      });

      if (!turno) {
        throw new CajaError(
          409,
          "CAJA_CERRADA",
          "La caja está cerrada. Solicita al cajero que abra el turno."
        );
      }

      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          detalles: { include: { producto: true } },
        },
      });

      if (!pedido) {
        throw new CajaError(404, "PEDIDO_NO_ENCONTRADO", "Pedido no encontrado.");
      }

      const isAdmin = actor.sections.includes("admin");
      if (!allowAnyOrder && !isAdmin && pedido.usuarioId !== actor.sub) {
        throw new CajaError(
          403,
          "FORBIDDEN",
          "Solo el mesero responsable o un administrador puede cobrar este pedido."
        );
      }

      if (pedido.estado !== "Pendiente") {
        throw new CajaError(400, "ESTADO_INVALIDO", "El pedido no está listo para cobro.");
      }

      if (pedido.detalles.length === 0) {
        throw new CajaError(400, "PEDIDO_VACIO", "El pedido no tiene productos.");
      }

      if (pedido.detalles.some((detalle) => detalle.estado !== "Listo")) {
        throw new CajaError(
          409,
          "COCINA_PENDIENTE",
          "No se puede cobrar. Aún hay platos pendientes en cocina."
        );
      }

      const subtotal = roundMoney(
        pedido.detalles.reduce(
          (total, detalle) =>
            total + Number(detalle.producto.precio) * detalle.cantidad,
          0
        )
      );
      const descuentoTotal = Number(pedido.descuentoTotal);
      const propinaTotal = Number(pedido.propinaTotal);
      const totalAntes = roundMoney(subtotal - descuentoTotal + propinaTotal);
      const totalPagadoAntes = Number(pedido.totalPagado);
      const saldoAntes = roundMoney(totalAntes - totalPagadoAntes);
      const pedidoAntes = {
        estado: pedido.estado,
        estadoPago: pedido.estadoPago,
        total: totalAntes,
        totalPagado: totalPagadoAntes,
        saldo: saldoAntes,
        propinaTotal,
      };

      if (saldoAntes <= 0) {
        throw new CajaError(409, "PEDIDO_YA_PAGADO", "El pedido ya está pagado.");
      }

      let montoPago = 0;
      let aplicacionesCalculadas: Array<{
        pedidoDetalleId: number;
        cantidad: number;
        monto: number;
      }> = [];

      if (aplicacionesInput.length > 0) {
        const pedidoDetalles = new Map(
          pedido.detalles.map((detalle) => [detalle.id, detalle])
        );
        const existentes = await tx.pagoAplicacion.findMany({
          where: {
            pedidoDetalle: { pedidoId },
            pago: { estado: { not: "Anulado" } },
          },
          select: { pedidoDetalleId: true, cantidad: true },
        });
        const pagadoPorDetalle = new Map<number, number>();
        for (const existente of existentes) {
          pagadoPorDetalle.set(
            existente.pedidoDetalleId,
            (pagadoPorDetalle.get(existente.pedidoDetalleId) ?? 0) + existente.cantidad
          );
        }

        const solicitadoPorDetalle = new Map<number, number>();
        for (const aplicacion of aplicacionesInput) {
          const detalleId = Number(aplicacion.pedidoDetalleId);
          const cantidad = Math.floor(Number(aplicacion.cantidad));
          if (!Number.isInteger(detalleId) || detalleId <= 0 || cantidad <= 0) {
            throw new CajaError(
              400,
              "APLICACION_INVALIDA",
              "Una de las aplicaciones de pago es inválida."
            );
          }
          const detalle = pedidoDetalles.get(detalleId);
          if (!detalle) {
            throw new CajaError(
              400,
              "DETALLE_INVALIDO",
              "Uno de los platos no pertenece al pedido."
            );
          }
          const pendiente =
            detalle.cantidad - (pagadoPorDetalle.get(detalleId) ?? 0);
          const solicitado =
            (solicitadoPorDetalle.get(detalleId) ?? 0) + cantidad;
          if (solicitado > pendiente) {
            throw new CajaError(
              409,
              "CANTIDAD_EXCEDIDA",
              `La cantidad de "${detalle.producto.nombre}" supera lo pendiente.`
            );
          }
          solicitadoPorDetalle.set(detalleId, solicitado);
        }

        aplicacionesCalculadas = aplicacionesInput.map((aplicacion) => {
          const detalle = pedidoDetalles.get(Number(aplicacion.pedidoDetalleId))!;
          const cantidad = Math.floor(Number(aplicacion.cantidad));
          return {
            pedidoDetalleId: detalle.id,
            cantidad,
            monto: calcularMontoItem(
              Number(detalle.producto.precio),
              cantidad,
              subtotal,
              descuentoTotal
            ),
          };
        });

        const totalPendiente = pedido.detalles.reduce(
          (total, detalle) =>
            total + detalle.cantidad - (pagadoPorDetalle.get(detalle.id) ?? 0),
          0
        );
        const totalSolicitado = Array.from(solicitadoPorDetalle.values()).reduce(
          (total, cantidad) => total + cantidad,
          0
        );
        const esFinal = totalSolicitado >= totalPendiente;

        let sumaLineas = roundMoney(
          aplicacionesCalculadas.reduce((total, aplicacion) => total + aplicacion.monto, 0)
        );

        if (esFinal) {
          const ajuste = roundMoney(saldoAntes - sumaLineas);
          if (Math.abs(ajuste) >= 0.01) {
            const ultima = aplicacionesCalculadas[aplicacionesCalculadas.length - 1];
            ultima.monto = roundMoney(Math.max(0, ultima.monto + ajuste));
            sumaLineas = roundMoney(
              aplicacionesCalculadas.reduce((total, aplicacion) => total + aplicacion.monto, 0)
            );
          }
        }

        montoPago = sumaLineas;
      } else {
        montoPago = fullBalanceOnly
          ? saldoAntes
          : roundMoney(Number(monto));
      }

      if (!Number.isFinite(montoPago) || montoPago <= 0) {
        throw new CajaError(400, "MONTO_INVALIDO", "El monto debe ser mayor a cero.");
      }

      if (montoPago > saldoAntes + 0.001) {
        throw new CajaError(
          400,
          "MONTO_EXCEDE_SALDO",
          "El monto supera el saldo pendiente del pedido."
        );
      }

      if (fullBalanceOnly && Math.abs(montoPago - saldoAntes) >= 0.01) {
        throw new CajaError(
          400,
          "PAGO_PARCIAL_NO_PERMITIDO",
          "El mesero solo puede cobrar el saldo completo."
        );
      }

      let recibido: number | null = null;
      let cambio: number | null = null;

      if (metodo === "Efectivo") {
        const totalCobrado = roundMoney(montoPago + propinaInput);
        if (montoRecibido !== null && montoRecibido !== undefined) {
          recibido = roundMoney(Number(montoRecibido));
          if (!Number.isFinite(recibido) || recibido < totalCobrado) {
            throw new CajaError(
              400,
              "RECIBIDO_INVALIDO",
              "El monto recibido no cubre el total a cobrar."
            );
          }
        } else {
          recibido = totalCobrado;
        }
        cambio = roundMoney(Math.max(0, recibido - totalCobrado));
      }

      const ahora = new Date();
      const nuevoPropinaTotal = roundMoney(propinaTotal + propinaInput);
      const nuevoTotal = roundMoney(subtotal - descuentoTotal + nuevoPropinaTotal);
      const nuevoTotalPagado = roundMoney(
        totalPagadoAntes + montoPago + propinaInput
      );
      const nuevoSaldo = roundMoney(nuevoTotal - nuevoTotalPagado);
      const pagado = nuevoSaldo <= 0.009;
      const saldoFinal = pagado ? 0 : nuevoSaldo;

      const actualizado = await tx.pedido.updateMany({
        where: {
          id: pedidoId,
          estado: "Pendiente",
          saldo: saldoAntes,
          totalPagado: totalPagadoAntes,
        },
        data: {
          subtotal,
          descuentoTotal,
          propinaTotal: nuevoPropinaTotal,
          total: nuevoTotal,
          totalPagado: nuevoTotalPagado,
          saldo: saldoFinal,
          estadoPago: pagado ? "Pagado" : "Parcial",
          estado: pagado ? "Pagado" : "Pendiente",
          pagadoEn: pagado ? ahora : null,
          metodoPago: metodo,
        },
      });

      if (actualizado.count === 0) {
        throw new CajaError(
          409,
          "PAGO_CONFLICTO",
          "El saldo del pedido cambió. Recarga la cuenta e intenta nuevamente."
        );
      }

      for (const detalle of pedido.detalles) {
        await tx.pedidoDetalle.update({
          where: { id: detalle.id },
          data: { precio_unitario: Number(detalle.producto.precio) },
        });
      }

      const pago = await tx.pago.create({
        data: {
          pedidoId,
          turnoId: turno.id,
          cajeroId: actor.sub,
          cajeroNombre: actor.nombre,
          metodo,
          monto: montoPago,
          propina: propinaInput,
          referencia: ref || null,
          codigoAutorizacion: autorizacion || null,
          terminal: terminalInput || null,
          montoRecibido: recibido,
          cambio,
          etiqueta: etiquetaInput || null,
          estado: "Registrado",
          origen: "POS",
        },
      });

      if (aplicacionesCalculadas.length > 0) {
        await tx.pagoAplicacion.createMany({
          data: aplicacionesCalculadas.map((aplicacion) => ({
            pagoId: pago.id,
            pedidoDetalleId: aplicacion.pedidoDetalleId,
            cantidad: aplicacion.cantidad,
            monto: aplicacion.monto,
          })),
        });
      }

      if (pagado) {
        await tx.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: "Libre" },
        });
        await tx.comprobante.upsert({
          where: { pedidoId },
          create: {
            pedidoId,
            tipo: "Ticket",
            monto: nuevoTotal,
            estado: "Emitido",
          },
          update: {
            monto: nuevoTotal,
            estado: "Emitido",
          },
        });
      }

      if (audit) {
        await auditLog(
          {
            actor: actorFromSession(actor),
            accion: "payment.create",
            entidad: "Pago",
            entidadId: pago.id,
            antes: pedidoAntes,
            despues: {
              pagoId: pago.id,
              pedidoId,
              metodo,
              monto: montoPago,
              propina: propinaInput,
              total: nuevoTotal,
              totalPagado: nuevoTotalPagado,
              saldo: saldoFinal,
              estadoPago: pagado ? "Pagado" : "Parcial",
              cambio,
              aplicaciones: aplicacionesCalculadas,
            },
            motivo: `Pago registrado (${metodo})`,
            turnoId: turno.id,
          },
          audit,
          tx
        );
      }

      return {
        pagoId: pago.id,
        turnoId: turno.id,
        monto: montoPago,
        propina: propinaInput,
        total: nuevoTotal,
        totalPagado: nuevoTotalPagado,
        saldo: saldoFinal,
        cambio,
        metodo,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
