import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const usuarioId = searchParams.get('usuarioId');

    if (!usuarioId) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 400 });
    }

    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Pendiente',
        usuarioId: usuarioId // Filtramos para que cada mesero vea SOLO sus mesas
      },
      include: {
        mesa: true,
        detalles: { include: { producto: true } }
      },
      orderBy: { fecha_creacion: 'desc' }
    });

    return NextResponse.json(pedidos);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}