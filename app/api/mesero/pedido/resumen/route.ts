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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de pedido no proporcionado' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(id) },
      include: {
        mesa: true, // Para saber el nombre/número de la mesa
        detalles: {
          include: {
            producto: true // Para saber el nombre del plato
          }
        }
      }
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const isAdmin = session.sections.includes('admin');
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'No puedes ver un pedido de otro mesero.' },
        { status: 403 }
      );
    }

    return NextResponse.json(pedido);
  } catch (error) {
    console.error("Error al obtener resumen:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}