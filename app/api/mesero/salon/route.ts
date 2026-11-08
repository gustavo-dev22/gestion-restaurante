import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { revalidateTag } from 'next/cache';

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
      // Bloqueo lógico atómico: evita que dos meseros abran la misma mesa.
      const mesaTomada = await tx.mesa.updateMany({
        where: { id: mesaId, estado: 'Libre' },
        data: { estado: 'Ocupada' },
      });

      if (mesaTomada.count === 0) {
        const existe = await tx.mesa.findUnique({ where: { id: mesaId }, select: { id: true } });
        throw new Error(existe ? 'MESA_NO_DISPONIBLE' : 'MESA_NO_ENCONTRADA');
      }

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

      return { pedido: nuevoPedido };
    });

    revalidateTag("dashboard", "max");

    return NextResponse.json(resultado);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'MESA_NO_DISPONIBLE') {
      return NextResponse.json({ error: 'La mesa ya no está disponible' }, { status: 409 });
    }
    if (message === 'MESA_NO_ENCONTRADA') {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }
    logger.error('Error al abrir mesa', { error });
    return NextResponse.json({ error: 'Error interno en el servidor' }, { status: 500 });
  }
}
