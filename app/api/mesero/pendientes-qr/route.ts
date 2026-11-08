import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { expireStaleQrOrders } from '@/lib/qr-orders';

export async function GET() {
  try {
    await expireStaleQrOrders();

    const pendientes = await prisma.pedido.findMany({
      where: { estado: 'Por Confirmar' },
      include: { mesa: true },
      orderBy: { fecha_creacion: 'asc' }
    });
    return NextResponse.json(pendientes);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}