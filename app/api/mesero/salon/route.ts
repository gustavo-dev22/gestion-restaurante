import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeLocal } from '@/lib/rbac';
import { parseJson, salonMesaSchema } from '@/lib/api-validation';
import { logger } from '@/lib/logger';
import { revalidateTag } from 'next/cache';
import { getFranjaInicio } from "@/lib/reservation-slot";

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:accept");
  if (session instanceof NextResponse) return session;

  const parsed = await parseJson(request, salonMesaSchema);
  if (!parsed.success) return parsed.response;
  const mesaId = parsed.data.mesaId;

  try {

    const ahora = Date.now();
    const reservaCercana = await prisma.reserva.findFirst({
      where: {
        mesaId,
        estado: 'Confirmada',
        franjaInicio: getFranjaInicio(new Date(ahora)),
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
          subtotal: 0,
          descuentoTotal: 0,
          propinaTotal: 0,
          totalPagado: 0,
          saldo: 0,
          estadoPago: 'Pendiente',
          estado: 'BORRADOR',
          origen: 'POS',
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
