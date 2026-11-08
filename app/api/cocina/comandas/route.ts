import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get('area') || 'Cocina'; // Por defecto Cocina

  try {
    const comandas = await prisma.pedidoDetalle.findMany({
      where: {
        estado: { not: 'Listo' },
        pedido: { estado: 'Pendiente' },
        producto: {
          categoria: {
            area: area // Filtramos por el área recibida
          }
        }
      },
      include: {
        pedido: { include: { mesa: true } },
        producto: true
      },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(comandas);
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

// NUEVO: Para actualizar el estado del plato
export async function PATCH(request: Request) {
  try {
    const { detalleId, nuevoEstado } = await request.json();
    const actualizado = await prisma.pedidoDetalle.update({
      where: { id: Number(detalleId) },
      data: { estado: nuevoEstado }
    });
    return NextResponse.json(actualizado);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}