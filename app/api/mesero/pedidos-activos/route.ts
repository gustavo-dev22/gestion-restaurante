import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isAdmin = session.sections.includes('admin');
    const usuarioId = isAdmin ? searchParams.get('usuarioId') ?? session.sub : session.sub;

    const pedidos = await prisma.pedido.findMany({
      where: {
        estado: 'Pendiente',
        usuarioId,
      },
      include: {
        mesa: true,
        detalles: { include: { producto: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    return NextResponse.json(pedidos);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al obtener pedidos' }, { status: 500 });
  }
}
