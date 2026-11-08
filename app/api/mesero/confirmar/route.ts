import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const { pedidoId, usuarioId, nombreMesero } = await request.json();

    const pedidoActualizado = await prisma.pedido.update({
      where: { id: Number(pedidoId) },
      data: {
        estado: 'Pendiente', // Pasa de 'Por Confirmar' a 'Pendiente' (en cocina)
        usuarioId: usuarioId, // El GUID del mesero que hizo clic
        nombreMesero: nombreMesero,
      }
    });

    return NextResponse.json(pedidoActualizado);
  } catch (error) {
    return NextResponse.json({ error: 'Error al asignar mesero' }, { status: 500 });
  }
}