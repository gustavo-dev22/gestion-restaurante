import { prisma } from "@/lib/prisma";
import { ACTIVE_ORDER_STATES, QR_PENDING_TTL_MS } from "@/lib/order-config";

/**
 * Marca como "Expirado" los pedidos QR que llevan más de 5 minutos sin ser
 * aceptados por un mesero y libera la mesa si no tiene otro pedido activo.
 * Es idempotente y seguro ante llamadas concurrentes.
 */
export async function expireStaleQrOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - QR_PENDING_TTL_MS);

  const vencidos = await prisma.pedido.findMany({
    where: {
      estado: "Por Confirmar",
      fecha_creacion: { lt: cutoff },
    },
    select: { id: true, mesaId: true },
  });

  if (vencidos.length === 0) return 0;

  let expirados = 0;

  for (const pedido of vencidos) {
    await prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.updateMany({
        where: { id: pedido.id, estado: "Por Confirmar" },
        data: { estado: "Expirado" },
      });

      if (actualizado.count === 0) return;
      expirados += 1;

      // Devuelve al stock los productos de un pedido que nunca llegó a cocina.
      const detalles = await tx.pedidoDetalle.findMany({
        where: { pedidoId: pedido.id },
        select: { productoId: true, cantidad: true },
      });

      for (const detalle of detalles) {
        await tx.producto.updateMany({
          where: { id: detalle.productoId },
          data: { stock: { increment: detalle.cantidad } },
        });
      }

      const otroActivo = await tx.pedido.findFirst({
        where: {
          mesaId: pedido.mesaId,
          id: { not: pedido.id },
          estado: { in: [...ACTIVE_ORDER_STATES] },
        },
        select: { id: true },
      });

      if (!otroActivo) {
        await tx.mesa.updateMany({
          where: { id: pedido.mesaId, estado: "Ocupada" },
          data: { estado: "Libre" },
        });
      }
    });
  }

  return expirados;
}
