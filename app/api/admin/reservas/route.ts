import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actorFromSession, auditLogSafe, getAuditContext } from '@/lib/audit';
import { authorizeLocal } from '@/lib/rbac';

export async function GET() {
  try {
    const reservas = await prisma.reserva.findMany({
      include: { mesa: true },
      orderBy: { fechaReserva: 'asc' }
    });
    return NextResponse.json(reservas);
  } catch {
    return NextResponse.json({ error: 'Error al obtener reservas' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "reservations:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id, nuevoEstado } = await request.json();

    if (!id || !['Confirmada', 'Finalizada', 'Cancelada'].includes(nuevoEstado)) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    // La mesa ya no se marca/desmarca manualmente: la disponibilidad se
    // calcula dinámicamente según la fecha/hora de la reserva.
    const antes = await prisma.reserva.findUnique({ where: { id: Number(id) } });
    const reserva = await prisma.reserva.update({
      where: { id: Number(id) },
      data: { estado: nuevoEstado },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "reservation.update",
        entidad: "Reserva",
        entidadId: reserva.id,
        antes,
        despues: reserva,
        motivo: `Estado de reserva: ${nuevoEstado}`,
      },
      getAuditContext(request)
    );

    return NextResponse.json(reserva);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar reserva' }, { status: 500 });
  }
}
