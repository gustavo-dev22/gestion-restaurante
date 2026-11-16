import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CajaError } from "@/lib/caja-errors";
import { calcularTotalPedido } from "@/lib/order-math";
import { esMetodoPago, roundMoney } from "@/lib/caja-types";
import type { SessionPayload } from "@/lib/auth/session";

export interface RegistrarPagoInput {
  actor: SessionPayload;
  pedidoId: number;
  metodo: string;
  referencia?: string | null;
  allowAnyOrder?: boolean;
}

export interface RegistrarPagoResult {
  pagoId: number;
  turnoId: number;
  total: number;
  metodo: string;
}

export async function registrarPago({
  actor,
  pedidoId,
  metodo,
  referencia,
  allowAnyOrder = false,
}: RegistrarPagoInput): Promise<RegistrarPagoResult> {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    throw new CajaError(400, "PEDIDO_INVALIDO", "El pedido es inválido.");
  }

  if (!esMetodoPago(metodo)) {
    throw new CajaError(400, "METODO_INVALIDO", "El método de pago es inválido.");
  }

  const ref = String(referencia ?? "").trim().slice(0, 100);

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

      const total = roundMoney(
        calcularTotalPedido(
          pedido.detalles.map((detalle) => ({
            precio: Number(detalle.producto.precio),
            cantidad: detalle.cantidad,
          }))
        )
      );

      const ahora = new Date();
      const actualizado = await tx.pedido.updateMany({
        where: { id: pedidoId, estado: "Pendiente" },
        data: {
          estado: "Pagado",
          total,
          metodoPago: metodo,
          pagadoEn: ahora,
        },
      });

      if (actualizado.count === 0) {
        throw new CajaError(409, "PEDIDO_YA_PAGADO", "El pedido ya fue cobrado.");
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
          monto: total,
          referencia: ref || null,
          estado: "Registrado",
          origen: "POS",
        },
      });

      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: "Libre" },
      });

      return {
        pagoId: pago.id,
        turnoId: turno.id,
        total,
        metodo,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
