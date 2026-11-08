import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const { pedidoId, metodoPago } = await request.json();

    // 1. VALIDACIÓN DE COCINA: Buscamos si hay detalles de este pedido que no estén "Listos"
    // Asumiendo que tus estados de producto en cocina son 'Pendiente' o 'En Preparacion'
    const itemsPendientes = await prisma.pedidoDetalle.findFirst({
      where: {
        pedidoId: Number(pedidoId),
        estado: { in: ['Pendiente'] } // Ajusta estos nombres a tus estados reales
      }
    });

    if (itemsPendientes) {
      return NextResponse.json({ 
        error: 'COCINA_PENDIENTE', 
        message: 'No se puede cobrar. Aún hay platos pendientes en cocina.' 
      }, { status: 400 });
    }

    // 1. Buscamos el pedido para saber qué mesa liberar
    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(pedidoId) }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    // 2. Transacción: Pagar pedido y Liberar mesa
    await prisma.$transaction([
      // Marcar pedido como pagado
      prisma.pedido.update({
        where: { id: Number(pedidoId) },
        data: { estado: 'Pagado' }
      }),
      // Liberar la mesa
      prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'Libre' }
      })
      // Aquí podrías insertar en una tabla "Ventas" si la tuvieses
    ]);

    return NextResponse.json({ message: 'Pago procesado y mesa liberada' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al procesar el pago' }, { status: 500 });
  }
}