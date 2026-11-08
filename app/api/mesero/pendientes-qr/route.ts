import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const pendientes = await prisma.pedido.findMany({
      where: { estado: 'Por Confirmar' },
      include: { mesa: true },
      orderBy: { fecha_creacion: 'asc' }
    });
    return NextResponse.json(pendientes);
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}