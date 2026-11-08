import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { pedidoId } = await request.json();
    const id = Number(pedidoId);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      select: { id: true, estado: true, usuarioId: true },
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    if (pedido.estado !== 'Por Confirmar') {
      return NextResponse.json(
        { error: 'ESTADO_INVALIDO', message: 'El pedido ya fue confirmado o no está pendiente.' },
        { status: 409 }
      );
    }

    if (pedido.usuarioId && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: 'YA_ASIGNADO', message: 'Otro mesero ya tomó este pedido.' },
        { status: 409 }
      );
    }

    const pedidoActualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: 'Pendiente',
        usuarioId: session.sub,
        nombreMesero: session.nombre,
      },
    });

    return NextResponse.json(pedidoActualizado);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al asignar mesero' }, { status: 500 });
  }
}
