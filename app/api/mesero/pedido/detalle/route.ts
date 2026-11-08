import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// app/api/mesero/pedido/detalle/route.ts

export async function POST(request: Request) {
  try {
    const { pedidoId, items } = await request.json();

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        // 1. BUSCAR SI EL PRODUCTO YA ESTÁ EN EL PEDIDO
        const detalleExistente = await tx.pedidoDetalle.findFirst({
          where: {
            pedidoId: Number(pedidoId),
            productoId: Number(item.id),
          }
        });

        if (detalleExistente) {
          // Si existe, actualizamos la cantidad
          await tx.pedidoDetalle.update({
            where: { id: detalleExistente.id },
            data: { cantidad: { increment: Number(item.cantidad) } }
          });
        } else {
          // Si no existe, creamos la fila nueva
          await tx.pedidoDetalle.create({
            data: {
              pedidoId: Number(pedidoId),
              productoId: Number(item.id),
              cantidad: Number(item.cantidad),
              precio_unitario: Number(item.precio),
              estado: 'Pendiente'
            }
          });
        }

        // 2. DESCONTAR EL STOCK (Igual que antes)
        await tx.producto.update({
          where: { id: Number(item.id) },
          data: { stock: { decrement: Number(item.cantidad) } }
        });
      }

      // 3. ACTUALIZAR EL TOTAL DEL PEDIDO
      const totalNuevosItems = items.reduce((acc: number, item: any) => 
        acc + (Number(item.precio) * Number(item.cantidad)), 0
      );

      await tx.pedido.update({
        where: { id: Number(pedidoId) },
        data: { total: { increment: totalNuevosItems } }
      });
    });

    return NextResponse.json({ message: 'Comanda agrupada y stock actualizado' });
  } catch (error) {
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 });
  }
}