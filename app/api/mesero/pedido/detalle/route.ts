import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { revalidateTag } from "next/cache";
import { withIdempotency } from "@/lib/idempotency";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { parseJson, detalleSchema } from "@/lib/api-validation";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const parsed = await parseJson(request, detalleSchema);
    if (!parsed.success) return parsed.response;
    const { pedidoId, items } = parsed.data;

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, estado: true, usuarioId: true, inventarioConsumido: true },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const isAdmin = session.sections.includes("admin");
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No puedes modificar un pedido de otro mesero." },
        { status: 403 }
      );
    }

    if (pedido.inventarioConsumido) {
      return NextResponse.json(
        {
          error: "INVENTARIO_CONSUMIDO",
          message: "No se pueden agregar platos después de iniciar cocina.",
        },
        { status: 409 }
      );
    }

    if (
      !["BORRADOR", "CONFIRMADO", "EN_COCINA", "PARCIALMENTE_LISTO", "LISTO"].includes(
        pedido.estado
      )
    ) {
      return NextResponse.json(
        {
          error: "ESTADO_INVALIDO",
          message: "Solo se pueden agregar platos antes de servir o cobrar el pedido.",
        },
        { status: 409 }
      );
    }

    const itemsNormalizados = items.map((item) => ({
      productoId: item.id,
      cantidad: item.cantidad,
    }));

    await prisma.$transaction(async (tx) => {
      let totalAgregado = 0;

      for (const item of itemsNormalizados) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          select: { id: true, nombre: true, precio: true, stock: true, tipoInventario: true, activo: true },
        });

        if (!producto || !producto.activo) {
          throw new Error(`PRODUCTO_INVALIDO:${item.productoId}`);
        }

        // Descuento atómico: evita stock negativo bajo concurrencia.
        if (producto.stock !== null && producto.tipoInventario !== "RECETA") {
          const descontado = await tx.producto.updateMany({
            where: { id: item.productoId, stock: { gte: item.cantidad } },
            data: { stock: { decrement: item.cantidad } },
          });

          if (descontado.count === 0) {
            throw new Error(`STOCK_INSUFICIENTE:${producto.nombre}`);
          }
        }

        const precio = Number(producto.precio);
        const subtotal = precio * item.cantidad;
        totalAgregado += subtotal;

        const detalleExistente = await tx.pedidoDetalle.findFirst({
          where: { pedidoId, productoId: item.productoId },
        });

        if (detalleExistente) {
          const nuevaCantidad = detalleExistente.cantidad + item.cantidad;
          await tx.pedidoDetalle.update({
            where: { id: detalleExistente.id },
            data: {
              cantidad: nuevaCantidad,
              precio_unitario: precio,
              estado: "PENDIENTE",
            },
          });
        } else {
          // 'subtotal' es una columna calculada en SQL Server: no se escribe.
          await tx.pedidoDetalle.create({
            data: {
              pedidoId,
              productoId: item.productoId,
              cantidad: item.cantidad,
              precio_unitario: precio,
              estado: "PENDIENTE",
            },
          });
        }

      }

      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          total: { increment: totalAgregado },
          subtotal: { increment: totalAgregado },
          saldo: { increment: totalAgregado },
          estadoPago: 'Pendiente',
          estado: 'CONFIRMADO',
        },
      });
    });

    await auditLogSafe(
      {
        actor: actorFromSession(session),
        accion: "order.items.add",
        entidad: "Pedido",
        entidadId: pedidoId,
        despues: { pedidoId, items: itemsNormalizados },
        motivo: "Platos agregados a la comanda",
      },
      getAuditContext(request)
    );

    revalidateTag("reportes", "max");
    revalidateTag("dashboard", "max");

    return NextResponse.json({ message: "Comanda registrada y stock actualizado" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("STOCK_INSUFICIENTE")) {
      const producto = message.split(":")[1];
      return NextResponse.json(
        {
          error: "STOCK_INSUFICIENTE",
          message: producto ? `Stock insuficiente para "${producto}".` : "No hay stock suficiente.",
        },
        { status: 409 }
      );
    }
    if (message.startsWith("PRODUCTO_INVALIDO")) {
      return NextResponse.json({ error: "PRODUCTO_INVALIDO", message: "Producto no disponible." }, { status: 400 });
    }
    logger.error("Error al procesar comanda", { error });
    return NextResponse.json({ error: "Error al procesar la comanda" }, { status: 500 });
  }
  });
}
