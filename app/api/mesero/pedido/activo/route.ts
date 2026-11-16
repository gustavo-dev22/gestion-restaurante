import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mesaId = searchParams.get('mesaId');

  const pedido = await prisma.pedido.findFirst({
    where: {
      mesaId: Number(mesaId),
      estado: { in: [...ACTIVE_ORDER_STATUSES] } // El pedido que aún no se paga
    },
    select: { 
      id: true, 
      usuarioId: true, 
      nombreMesero: true // <-- IMPORTANTE traerlo aquí
    },
    orderBy: { fecha_creacion: 'desc' }
  });

  return NextResponse.json({ pedidoId: pedido?.id, usuarioId: pedido?.usuarioId, nombreMesero: pedido?.nombreMesero });
}