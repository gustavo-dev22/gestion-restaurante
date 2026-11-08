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
    const { id, nuevoEstado } = await request.json();

    if (!id || !['Confirmada', 'Finalizada', 'Cancelada'].includes(nuevoEstado)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // La mesa ya no se marca/desmarca manualmente: la disponibilidad se
    // calcula dinámicamente según la fecha/hora de la reserva.
    const reserva = await prisma.reserva.update({
      where: { id: Number(id) },
      data: { estado: nuevoEstado },
    });

    return NextResponse.json(reserva);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 });
  }
}
