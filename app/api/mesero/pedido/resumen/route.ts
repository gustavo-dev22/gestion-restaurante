import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
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

    return NextResponse.json(pedido);
  } catch (error) {
    console.error("Error al obtener resumen:", error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}