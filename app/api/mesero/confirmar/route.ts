import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import { expireStaleQrOrders } from "@/lib/qr-orders";
import { parseJson, confirmarPedidoSchema } from "@/lib/api-validation";
import { logger } from "@/lib/logger";

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:accept");
  if (session instanceof NextResponse) return session;

  const parsed = await parseJson(request, confirmarPedidoSchema);
  if (!parsed.success) return parsed.response;
  const id = parsed.data.pedidoId;

  try {
    await expireStaleQrOrders();

    const claimed = await prisma.pedido.updateMany({
      where: {
        id,
        estado: "BORRADOR",
        OR: [{ usuarioId: null }, { usuarioId: session.sub }],
      },
      data: {
        estado: "CONFIRMADO",
        usuarioId: session.sub,
        nombreMesero: session.nombre,
      },
    });

    if (claimed.count === 0) {
      const actual = await prisma.pedido.findUnique({
        where: { id },
        select: { estado: true, usuarioId: true },
      });

      if (!actual) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }
      if (actual.estado === "ANULADO") {
        return NextResponse.json(
          { error: "ANULADO", message: "El pedido fue anulado y la mesa fue liberada." },
          { status: 409 }
        );
      }
      if (actual.usuarioId && actual.usuarioId !== session.sub) {
        return NextResponse.json(
          { error: "YA_ASIGNADO", message: "Otro mesero ya tomó este pedido." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: "ESTADO_INVALIDO",
          message: "El pedido ya no está pendiente de confirmación.",
        },
        { status: 409 }
      );
    }

    const pedidoActualizado = await prisma.pedido.findUnique({ where: { id } });

    if (pedidoActualizado) {
      await prisma.llamadoMesero.updateMany({
        where: {
          mesaId: pedidoActualizado.mesaId,
          estado: "PENDIENTE",
          usuarioId: null,
        },
        data: { usuarioId: session.sub, nombreMesero: session.nombre },
      });
    }

    await auditLogSafe(
      {
        actor: actorFromSession(session),
        accion: "order.confirm",
        entidad: "Pedido",
        entidadId: id,
        antes: { id, estado: "BORRADOR" },
        despues: pedidoActualizado,
        motivo: "Pedido QR asignado y confirmado",
      },
      getAuditContext(request)
    );

    return NextResponse.json(pedidoActualizado);
  } catch (error) {
    logger.error("Error al confirmar pedido", { error });
    return NextResponse.json({ error: "Error al asignar mesero" }, { status: 500 });
  }
}
