import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth/session';

const RESERVA_VENTANA_MS = 2 * 60 * 60 * 1000;

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await request.json();
    const mesaId = Number(body?.mesaId);

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ error: 'Mesa ID faltante' }, { status: 400 });
    }

    const ahora = Date.now();
    const reservaCercana = await prisma.reserva.findFirst({
      where: {
        mesaId,
        estado: 'Confirmada',
        fechaReserva: {
          gte: new Date(ahora - RESERVA_VENTANA_MS),
          lte: new Date(ahora + RESERVA_VENTANA_MS),
        },
      },
      select: { id: true },
    });

    if (reservaCercana) {
      return NextResponse.json(
        { error: 'MESA_RESERVADA', message: 'La mesa tiene una reserva próxima. Gestiónala desde Reservas.' },
        { status: 409 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });

      if (!mesa) {
        throw new Error('MESA_NO_ENCONTRADA');
      }
      if (mesa.estado !== 'Libre') {
        throw new Error('MESA_NO_DISPONIBLE');
      }

      const mesaActualizada = await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: 'Ocupada' },
      });

      const nuevoPedido = await tx.pedido.create({
        data: {
          mesaId,
          usuarioId: session.sub,
          nombreMesero: session.nombre,
          total: 0,
          estado: 'Pendiente',
          fecha_creacion: new Date(),
        },
      });

      return { mesa: mesaActualizada, pedido: nuevoPedido };
    });

    return NextResponse.json(resultado);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MESA_NO_DISPONIBLE') {
      return NextResponse.json({ error: 'La mesa ya no está disponible' }, { status: 409 });
    }
    if (message === 'MESA_NO_ENCONTRADA') {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }
    console.error('ERROR AL ABRIR MESA:', error);
    return NextResponse.json({ error: 'Error interno en el servidor' }, { status: 500 });
  }
}
