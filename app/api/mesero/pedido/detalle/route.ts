import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const pedidoId = Number(body?.pedidoId);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!pedidoId || Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, estado: true, usuarioId: true },
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

    if (pedido.estado !== "Pendiente") {
      return NextResponse.json(
        { error: "ESTADO_INVALIDO", message: "Solo se pueden agregar platos a pedidos pendientes." },
        { status: 400 }
      );
    }

    const itemsNormalizados: Array<{ productoId: number; cantidad: number }> = (
      items as Array<{ id?: unknown; cantidad?: unknown }>
    )
      .map((item) => ({
        productoId: Number(item.id),
        cantidad: Math.floor(Number(item.cantidad)),
      }))
      .filter((item) => item.productoId > 0 && item.cantidad > 0);

    if (itemsNormalizados.length === 0) {
      return NextResponse.json({ error: "No hay productos válidos" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      let totalAgregado = 0;

      for (const item of itemsNormalizados) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          select: { id: true, nombre: true, precio: true, stock: true, activo: true },
        });

        if (!producto || !producto.activo) {
          throw new Error(`PRODUCTO_INVALIDO:${item.productoId}`);
        }

        // Descuento atómico: evita stock negativo bajo concurrencia.
        if (producto.stock !== null) {
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
              estado: "Pendiente",
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
              estado: "Pendiente",
            },
          });
        }

      }

      await tx.pedido.update({
        where: { id: pedidoId },
        data: { total: { increment: totalAgregado } },
      });
    });

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
    console.error(error);
    return NextResponse.json({ error: "Error al procesar la comanda" }, { status: 500 });
  }
}
