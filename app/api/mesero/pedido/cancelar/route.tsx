import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { actorFromSession, auditLogSafe, getAuditContext } from '@/lib/audit';
import { authorizeLocal } from '@/lib/rbac';

export async function DELETE(request: Request) {
  const session = await authorizeLocal(request, "orders:cancel");
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const pedidoId = Number(searchParams.get('id'));

    if (!pedidoId || Number.isNaN(pedidoId)) {
      return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { detalles: true },
    });

    if (!pedido) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const isAdmin = session.sections.includes('admin');
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'No puedes cancelar un pedido de otro mesero.' },
        { status: 403 }
      );
    }

    if (pedido.detalles.length > 0) {
      return NextResponse.json({ error: 'No se puede cancelar un pedido con consumo' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.pedido.delete({ where: { id: pedidoId } }),
      prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: 'Libre' },
      }),
    ]);

    await auditLogSafe(
      {
        actor: actorFromSession(session),
        accion: "order.cancel",
        entidad: "Pedido",
        entidadId: pedidoId,
        antes: pedido,
        despues: null,
        motivo: "Pedido sin consumo cancelado y mesa liberada",
      },
      getAuditContext(request)
    );

    revalidateTag('dashboard', "max");

    return NextResponse.json({ message: 'Mesa liberada' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 });
  }
}
