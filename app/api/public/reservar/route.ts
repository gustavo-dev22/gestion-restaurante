import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const RESERVA_VENTANA_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clienteNombre, clienteTelefono, fechaReserva, numPersonas, mesaId } = body;

    const personas = parseInt(numPersonas, 10);
    const mesaNumerica = parseInt(mesaId, 10);
    const fecha = new Date(fechaReserva);

    if (!clienteNombre?.trim() || !clienteTelefono || !fechaReserva || !personas || !mesaNumerica) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (Number.isNaN(fecha.getTime()) || fecha.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'FECHA_INVALIDA', message: 'Selecciona una fecha y hora futura.' },
        { status: 400 }
      );
    }

    const mesa = await prisma.mesa.findUnique({ where: { id: mesaNumerica } });
    if (!mesa) {
      return NextResponse.json({ error: 'MESA_NO_ENCONTRADA' }, { status: 404 });
    }

    if (mesa.capacidad && personas > mesa.capacidad) {
      return NextResponse.json(
        {
          error: 'CAPACIDAD_EXCEDIDA',
          message: `La mesa admite hasta ${mesa.capacidad} personas.`,
        },
        { status: 400 }
      );
    }

    const conflicto = await prisma.reserva.findFirst({
      where: {
        mesaId: mesaNumerica,
        estado: 'Confirmada',
        fechaReserva: {
          gte: new Date(fecha.getTime() - RESERVA_VENTANA_MS),
          lte: new Date(fecha.getTime() + RESERVA_VENTANA_MS),
        },
      },
      select: { id: true },
    });

    if (conflicto) {
      return NextResponse.json(
        {
          error: 'NO_DISPONIBLE',
          message: 'Esa mesa ya tiene una reserva cerca de ese horario. Elige otra hora o mesa.',
        },
        { status: 409 }
      );
    }

    const nuevaReserva = await prisma.reserva.create({
      data: {
        clienteNombre: clienteNombre.trim(),
        clienteTelefono,
        fechaReserva: fecha,
        numPersonas: personas,
        mesaId: mesaNumerica,
        estado: 'Confirmada',
        fecha_creacion: new Date(),
      },
    });

    await prisma.mesa.update({
      where: { id: mesaNumerica },
      data: { estado: 'Reservada' },
    });

    return NextResponse.json(nuevaReserva);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }
}
