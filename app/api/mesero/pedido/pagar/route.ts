import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

const METODOS_PAGO = ["Efectivo", "Tarjeta", "Yape/Plin"];

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { pedidoId, metodoPago } = await request.json();
    const id = Number(pedidoId);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    if (!METODOS_PAGO.includes(metodoPago)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { detalles: { include: { producto: true } } },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const isAdmin = session.sections.includes("admin");
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Solo el mesero responsable o un administrador puede cobrar este pedido." },
        { status: 403 }
      );
    }

    if (pedido.estado !== "Pendiente") {
      return NextResponse.json(
        { error: "ESTADO_INVALIDO", message: "El pedido no está listo para cobro." },
        { status: 400 }
      );
    }

    if (pedido.detalles.length === 0) {
      return NextResponse.json(
        { error: "PEDIDO_VACIO", message: "El pedido no tiene productos." },
        { status: 400 }
      );
    }

    const pendientes = pedido.detalles.filter((detalle) => detalle.estado !== "Listo");
    if (pendientes.length > 0) {
      return NextResponse.json(
        {
          error: "COCINA_PENDIENTE",
          message: "No se puede cobrar. Aún hay platos pendientes en cocina.",
        },
        { status: 409 }
      );
    }

    // Recálculo estricto usando los precios reales de la base de datos.
    const lineas = pedido.detalles.map((detalle) => {
      const precioReal = Number(detalle.producto.precio);
      return {
        id: detalle.id,
        precioReal,
        subtotal: precioReal * detalle.cantidad,
      };
    });

    const totalReal = lineas.reduce((acc, linea) => acc + linea.subtotal, 0);

    await prisma.$transaction(async (tx) => {
      for (const linea of lineas) {
        await tx.pedidoDetalle.update({
          where: { id: linea.id },
          data: { precio_unitario: linea.precioReal, subtotal: linea.subtotal },
        });
      }

      await tx.pedido.update({
        where: { id },
        data: { estado: "Pagado", total: totalReal, metodoPago },
      });

      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: "Libre" },
      });
    });

    return NextResponse.json({
      message: "Pago procesado y mesa liberada",
      total: totalReal,
      metodoPago,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al procesar el pago" }, { status: 500 });
  }
}
