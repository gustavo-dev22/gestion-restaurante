import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { parseJson, pedidoEstadoSchema } from "@/lib/api-validation";
import {
  OrderStatusError,
  assertOrderTransition,
  normalizeOrderStatus,
} from "@/lib/order-status";
import { actorFromSession, auditLog, getAuditContext } from "@/lib/audit";

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:serve");
  if (session instanceof NextResponse) return session;

  const parsed = await parseJson(request, pedidoEstadoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: parsed.data.pedidoId },
        include: { detalles: { select: { id: true, estado: true } } },
      });
      if (!pedido) throw new OrderStatusError("El pedido no existe.");

      const estadoActual = normalizeOrderStatus(pedido.estado);
      assertOrderTransition(estadoActual, parsed.data.estado);

      if (parsed.data.estado === "SERVIDO") {
        if (
          pedido.detalles.length === 0 ||
          pedido.detalles.some((detalle) => !["LISTO", "SERVIDO"].includes(detalle.estado))
        ) {
          throw new OrderStatusError(
            "Todos los platos deben estar listos antes de marcar el pedido como servido."
          );
        }
        await tx.pedidoDetalle.updateMany({
          where: { pedidoId: pedido.id, estado: "LISTO" },
          data: { estado: "SERVIDO" },
        });
      }

      const actualizado = await tx.pedido.update({
        where: { id: pedido.id },
        data: { estado: parsed.data.estado },
      });

      return { pedido: actualizado, antes: estadoActual };
    });

    await auditLog(
      {
        actor: actorFromSession(session),
        accion: "order.status.update",
        entidad: "Pedido",
        entidadId: resultado.pedido.id,
        antes: { estado: resultado.antes },
        despues: { estado: resultado.pedido.estado },
        motivo: `Estado de pedido: ${resultado.pedido.estado}`,
      },
      getAuditContext(request)
    );

    return NextResponse.json(resultado.pedido);
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "Error al actualizar el pedido" }, { status: 500 });
  }
}
