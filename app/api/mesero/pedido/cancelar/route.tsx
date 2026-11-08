import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pedidoId = searchParams.get('id');

    const pedido = await prisma.pedido.findUnique({
      where: { id: Number(pedidoId) },
      include: { detalles: true }
    });

    if (pedido?.detalles.length === 0) {
      await prisma.$transaction([
        prisma.pedido.delete({ where: { id: Number(pedidoId) } }),
        prisma.mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'Libre' }
        })
      ]);
      return NextResponse.json({ message: 'Mesa liberada' });
    }

    return NextResponse.json({ error: 'No se puede cancelar un pedido con consumo' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 });
  }
}