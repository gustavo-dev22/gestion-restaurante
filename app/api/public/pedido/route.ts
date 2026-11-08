import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expireStaleQrOrders } from '@/lib/qr-orders';
import { getClientIp, rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { calcularTotalPedido } from '@/lib/order-math';
import { logger } from '@/lib/logger';
import { revalidateTag } from 'next/cache';
import { withIdempotency } from '@/lib/idempotency';

const ESTADOS_ACTIVOS = ['Por Confirmar', 'Pendiente'];

class MesaNoDisponibleError extends Error {}
class ProductoInvalidoError extends Error {}
class StockInsuficienteError extends Error {
  productoId: number;
  constructor(productoId: number, message: string) {
    super(message);
    this.productoId = productoId;
  }
}

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
  return withIdempotency(request, async () => {
  try {
    const limit = rateLimit(`public:pedido:${getClientIp(request)}`, 10, 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'RATE_LIMIT', message: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.' },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

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

    const resultado = await prisma.$transaction(async (tx) => {
      // Bloqueo lógico atómico: solo una transacción puede pasar la mesa de
      // "Libre" a "Ocupada". Las demás reciben count = 0.
      const mesaTomada = await tx.mesa.updateMany({
        where: { id: mesaId, estado: 'Libre' },
        data: { estado: 'Ocupada' },
      });

      if (mesaTomada.count === 0) {
        throw new MesaNoDisponibleError('La mesa ya no está disponible');
      }

      const detalles: Array<{
        productoId: number;
        cantidad: number;
        precio_unitario: number;
        estado: string;
      }> = [];

      for (const item of itemsNormalizados) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          select: { id: true, nombre: true, precio: true, stock: true, activo: true },
        });

        if (!producto || !producto.activo) {
          throw new ProductoInvalidoError(`El producto ${item.productoId} no está disponible.`);
        }

        // Descuento atómico de stock: la condición evita negativos por concurrencia.
        if (producto.stock !== null) {
          const descontado = await tx.producto.updateMany({
            where: { id: item.productoId, stock: { gte: item.cantidad } },
            data: { stock: { decrement: item.cantidad } },
          });

          if (descontado.count === 0) {
            throw new StockInsuficienteError(
              producto.id,
              `Stock insuficiente para "${producto.nombre}".`
            );
          }
        }

        const precio = Number(producto.precio);
        detalles.push({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precio_unitario: precio,
          estado: 'Pendiente',
        });
      }

      const total = calcularTotalPedido(
        detalles.map((detalle) => ({
          precio: detalle.precio_unitario,
          cantidad: detalle.cantidad,
        }))
      );

      return tx.pedido.create({
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
    });

    revalidateTag("reportes", "max");
    revalidateTag("dashboard", "max");

    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof MesaNoDisponibleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof StockInsuficienteError) {
      return NextResponse.json(
        { error: 'STOCK_INSUFICIENTE', message: error.message, productoId: error.productoId },
        { status: 409 }
      );
    }
    if (error instanceof ProductoInvalidoError) {
      return NextResponse.json({ error: 'PRODUCTO_INVALIDO', message: error.message }, { status: 400 });
    }
    logger.error('Error al procesar pedido QR', { error });
    return NextResponse.json({ error: 'Error al procesar pedido' }, { status: 500 });
  }
  });
}
