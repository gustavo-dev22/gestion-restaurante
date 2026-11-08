import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const reservas = await prisma.reserva.findMany({
      include: { mesa: true },
      orderBy: { fechaReserva: 'asc' }
    });
    return NextResponse.json(reservas);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, nuevoEstado, mesaId } = await request.json();

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Actualizar el estado de la reserva
      const reservaAct = await tx.reserva.update({
        where: { id: Number(id) },
        data: { estado: nuevoEstado }
      });

      // 2. Si el cliente llegó o canceló, liberamos o preparamos la mesa
      // Si el estado es 'Finalizada' o 'Cancelada', la mesa vuelve a 'Libre'
      if (nuevoEstado === 'Finalizada' || nuevoEstado === 'Cancelada') {
        await tx.mesa.update({
          where: { id: mesaId },
          data: { estado: 'Libre' }
        });
      }

      return reservaAct;
    });

    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 });
  }
}