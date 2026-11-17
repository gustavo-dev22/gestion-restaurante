import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import {
  parseJson,
  parseQuery,
  comandaEstadoSchema,
} from "@/lib/api-validation";
import {
  ACTIVE_ORDER_STATUSES,
  OrderStatusError,
  assertDetailTransition,
  deriveOrderStatus,
  normalizeDetailStatus,
  normalizeOrderStatus,
} from "@/lib/order-status";
import { actorFromSession, auditLog, getAuditContext } from "@/lib/audit";
import { consumirInventarioPedido, InventoryError } from "@/lib/inventory";
import { logger } from "@/lib/logger";

const querySchema = z.object({
  area: z.string().trim().max(20).default("Cocina"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(searchParams, querySchema);
  if (!parsed.success) return parsed.response;

  try {
    const comandas = await prisma.pedidoDetalle.findMany({
      where: {
        estado: { in: ["PENDIENTE", "EN_PREPARACION"] },
        pedido: {
          estado: { in: ["CONFIRMADO", "EN_COCINA", "PARCIALMENTE_LISTO"] },
        },
        producto: {
          categoria: { area: parsed.data.area },
        },
      },
      include: {
        pedido: { include: { mesa: true } },
        producto: true,
      },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(comandas);
  } catch {
    return NextResponse.json({ error: "Error al obtener comandas" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:prepare");
  if (session instanceof NextResponse) return session;

  const parsed = await parseJson(request, comandaEstadoSchema);
  if (!parsed.success) return parsed.response;
  const auditContext = getAuditContext(request);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const detalle = await tx.pedidoDetalle.findUnique({
        where: { id: parsed.data.detalleId },
        include: { pedido: true },
      });
      if (!detalle) {
        throw new OrderStatusError("El plato no existe.");
      }

      const pedidoEstado = normalizeOrderStatus(detalle.pedido.estado);
      if (!ACTIVE_ORDER_STATUSES.includes(pedidoEstado)) {
        throw new OrderStatusError("El pedido ya está cerrado o anulado.");
      }

      const estadoAnterior = normalizeDetailStatus(detalle.estado);
      assertDetailTransition(estadoAnterior, parsed.data.nuevoEstado);

      const actualizado = await tx.pedidoDetalle.update({
        where: { id: detalle.id },
        data: { estado: parsed.data.nuevoEstado },
      });

      if (!detalle.pedido.inventarioConsumido) {
        await consumirInventarioPedido(tx, detalle.pedidoId, session, auditContext);
      }

      const detalles = await tx.pedidoDetalle.findMany({
        where: { pedidoId: detalle.pedidoId },
        select: { estado: true },
      });
      const nuevoEstadoPedido = deriveOrderStatus(detalles, pedidoEstado);

      if (nuevoEstadoPedido !== pedidoEstado) {
        await tx.pedido.update({
          where: { id: detalle.pedidoId },
          data: { estado: nuevoEstadoPedido },
        });
      }

      return {
        detalle: actualizado,
        pedidoId: detalle.pedidoId,
        estadoAnterior,
        estadoPedidoAnterior: pedidoEstado,
        estadoPedido: nuevoEstadoPedido,
      };
    });

    await auditLog(
      {
        actor: actorFromSession(session),
        accion: "order.item.prepare",
        entidad: "PedidoDetalle",
        entidadId: resultado.detalle.id,
        antes: { estado: resultado.estadoAnterior },
        despues: { estado: resultado.detalle.estado },
        motivo: `Plato actualizado a ${resultado.detalle.estado}`,
      },
      auditContext
    );

    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof OrderStatusError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    logger.error("Error al actualizar comanda", { error });
    return NextResponse.json({ error: "Error al actualizar la comanda" }, { status: 500 });
  }
}
