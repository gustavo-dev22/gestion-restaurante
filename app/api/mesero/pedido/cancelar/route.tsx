import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function DELETE(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pedidoId = Number(searchParams.get('id'));

    if (!pedidoId || Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { detalles: true },
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const isAdmin = session.sections.includes('admin');
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'No puedes cancelar un pedido de otro mesero.' },
        { status: 403 }
      );
    }

    if (pedido.detalles.length > 0) {
      return NextResponse.json({ error: 'No se puede cancelar un pedido con consumo' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.pedido.delete({ where: { id: pedidoId } }),
      prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'Libre' },
      }),
    ]);

    revalidateTag('dashboard', "max");

    return NextResponse.json({ message: 'Mesa liberada' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 });
  }
}
