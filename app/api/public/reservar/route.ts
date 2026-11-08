import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clienteNombre, clienteTelefono, fechaReserva, numPersonas, mesaId } = body;

    const nuevaReserva = await prisma.reserva.create({
      data: {
        clienteNombre,
        clienteTelefono,
        fechaReserva: new Date(fechaReserva), // Formato ISO desde el front
        numPersonas: parseInt(numPersonas),
        mesaId: parseInt(mesaId),
        estado: 'Confirmada'
      }
    });

    // Opcional: Podrías marcar la mesa como "Reservada" de una vez
    await prisma.mesa.update({
      where: { id: parseInt(mesaId) },
      data: { estado: 'Reservada' } 
    });

    return NextResponse.json(nuevaReserva);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 });
  }
}