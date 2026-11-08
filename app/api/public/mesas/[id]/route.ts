import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RESERVA_VENTANA_MS = 2 * 60 * 60 * 1000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const idMesa = parseInt(resolvedParams.id);

    if (isNaN(idMesa)) {
      return NextResponse.json({ error: 'ID de mesa no válido' }, { status: 400 });
    }

    const mesa = await prisma.mesa.findUnique({
      where: { id: idMesa },
      select: {
        id: true,
        numero: true,
        estado: true,
        capacidad: true,
        zona: true,
      }
    });

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    // Bloqueo dinámico por reserva: si hay una reserva confirmada en la ventana
    // de ±2 horas, la mesa se reporta como "Reservada" sin cambiar su estado en BD.
    let estado = mesa.estado;
    if (mesa.estado === 'Libre') {
      const ahora = Date.now();
      const reservaCercana = await prisma.reserva.findFirst({
        where: {
          mesaId: idMesa,
          estado: 'Confirmada',
          fechaReserva: {
            gte: new Date(ahora - RESERVA_VENTANA_MS),
            lte: new Date(ahora + RESERVA_VENTANA_MS),
          },
        },
        select: { id: true },
      });

      if (reservaCercana) estado = 'Reservada';
    }

    return NextResponse.json({ ...mesa, estado });
  } catch (error) {
    console.error('DEBUG ERROR MESA:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
