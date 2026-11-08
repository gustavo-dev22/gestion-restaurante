import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expireStaleQrOrders } from '@/lib/qr-orders';

const ESTADOS_ACTIVOS = ['Por Confirmar', 'Pendiente'];

class MesaNoDisponibleError extends Error {}

export async function GET(request: Request) {
  try {
    await expireStaleQrOrders();

    const { searchParams } = new URL(request.url);
    const mesaId = Number(searchParams.get('mesaId'));

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ error: 'mesaId inválido' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: { in: ESTADOS_ACTIVOS },
      },
      include: {
        mesa: true,
        detalles: { include: { producto: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    return NextResponse.json(pedido ?? null);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el pedido' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await expireStaleQrOrders();

    const body = await request.json();
    const mesaId = Number(body?.mesaId);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ error: 'Mesa inválida' }, { status: 400 });
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
      return NextResponse.json({ error: 'El pedido no tiene productos válidos' }, { status: 400 });
    }

    // Los precios SIEMPRE se toman de la base de datos, nunca del cliente.
    const productos = await prisma.producto.findMany({
      where: {
        id: { in: itemsNormalizados.map((item) => item.productoId) },
        activo: true,
      },
      select: { id: true, precio: true },
    });

    const precios = new Map(productos.map((producto) => [producto.id, Number(producto.precio)]));

    if (productos.length !== new Set(itemsNormalizados.map((item) => item.productoId)).size) {
      return NextResponse.json(
        { error: 'Uno o más productos no están disponibles' },
        { status: 400 }
      );
    }

    // 'subtotal' es una columna calculada en SQL Server: nunca se escribe.
    const detalles = itemsNormalizados.map((item) => ({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precio_unitario: precios.get(item.productoId) ?? 0,
      estado: 'Pendiente',
    }));

    const total = itemsNormalizados.reduce(
      (acc, item) => acc + (precios.get(item.productoId) ?? 0) * item.cantidad,
      0
    );

    const resultado = await prisma.$transaction(async (tx) => {
      const mesaActual = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesaActual || mesaActual.estado !== 'Libre') {
        throw new MesaNoDisponibleError('La mesa ya no está disponible');
      }

      const nuevoPedido = await tx.pedido.create({
        data: {
          mesaId,
          total,
          estado: 'Por Confirmar',
          nombreMesero: 'Cliente (Digital)',
          fecha_creacion: new Date(),
          detalles: { create: detalles },
        },
        include: { detalles: true },
      });

      await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: 'Ocupada' },
      });

      return nuevoPedido;
    });

    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof MesaNoDisponibleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('ERROR PEDIDO PUBLICO:', error);
    return NextResponse.json({ error: 'Error al procesar pedido' }, { status: 500 });
  }
}
