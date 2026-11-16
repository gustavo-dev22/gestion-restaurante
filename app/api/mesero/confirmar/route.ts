import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actorFromSession, auditLogSafe, getAuditContext } from '@/lib/audit';
import { authorizeLocal } from '@/lib/rbac';
import { expireStaleQrOrders } from '@/lib/qr-orders';
import { logger } from '@/lib/logger';

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:accept");
  if (session instanceof NextResponse) return session;

  try {
    const { pedidoId } = await request.json();
    const id = Number(pedidoId);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    await expireStaleQrOrders();

    // Reclamo atómico: solo un mesero puede pasar el pedido a "Pendiente".
    const claimed = await prisma.pedido.updateMany({
      where: {
        id,
        estado: 'Por Confirmar',
        OR: [{ usuarioId: null }, { usuarioId: session.sub }],
      },
      data: {
        estado: 'Pendiente',
        usuarioId: session.sub,
        nombreMesero: session.nombre,
      },
    });

    if (claimed.count === 0) {
      const actual = await prisma.pedido.findUnique({
        where: { id },
        select: { estado: true, usuarioId: true },
      });

      if (!actual) {
        return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
      }
      if (actual.estado === 'Expirado') {
        return NextResponse.json(
          { error: 'EXPIRADO', message: 'El pedido expiró y la mesa fue liberada.' },
          { status: 409 }
        );
      }
      if (actual.usuarioId && actual.usuarioId !== session.sub) {
        return NextResponse.json(
          { error: 'YA_ASIGNADO', message: 'Otro mesero ya tomó este pedido.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'ESTADO_INVALIDO', message: 'El pedido ya no está pendiente de confirmación.' },
        { status: 409 }
      );
    }

    const pedidoActualizado = await prisma.pedido.findUnique({ where: { id } });

    // Si la mesa tenía un llamado sin responsable, ahora se le asigna a este mesero.
    if (pedidoActualizado) {
      await prisma.pedido.updateMany({
        where: { mesaId: pedidoActualizado.mesaId, estado: "Llamado", usuarioId: null },
        data: { usuarioId: session.sub, nombreMesero: session.nombre },
      });
    }

    await auditLogSafe(
      {
        actor: actorFromSession(session),
        accion: "order.confirm",
        entidad: "Pedido",
        entidadId: id,
        antes: { id, estado: "Por Confirmar" },
        despues: pedidoActualizado,
        motivo: "Pedido QR asignado y confirmado",
      },
      getAuditContext(request)
    );

    return NextResponse.json(pedidoActualizado);
  } catch (error) {
    logger.error('Error al confirmar pedido', { error });
    return NextResponse.json({ error: 'Error al asignar mesero' }, { status: 500 });
  }
}
