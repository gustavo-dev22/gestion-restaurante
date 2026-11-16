import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLog, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";

export async function DELETE(request: Request) {
  const session = await authorizeLocal(request, "orders:cancel");
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const pedidoId = Number(searchParams.get("id"));

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { motivo?: unknown } | null;
    const motivo =
      typeof body?.motivo === "string" && body.motivo.trim().length >= 3
        ? body.motivo.trim().slice(0, 500)
        : "Cancelación de apertura";

    const pedido = await prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { detalles: true },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const isAdmin = session.sections.includes("admin");
    if (!isAdmin && pedido.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "No puedes cancelar un pedido de otro mesero." },
        { status: 403 }
      );
    }

    if (pedido.detalles.length > 0) {
      return NextResponse.json(
        { error: "No se puede cancelar un pedido con consumo" },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: "ANULADO",
          motivoAnulacion: motivo,
          anuladoEn: new Date(),
          anuladoPorId: session.sub,
          anuladoPorNombre: session.nombre,
        },
      });
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: "Libre" },
      });

      await auditLog(
        {
          actor: actorFromSession(session),
          accion: "order.cancel",
          entidad: "Pedido",
          entidadId: pedidoId,
          antes: pedido,
          despues: { estado: "ANULADO", motivoAnulacion: motivo },
          motivo,
        },
        getAuditContext(request),
        tx
      );
    });

    revalidateTag("dashboard", "max");

    return NextResponse.json({ message: "Pedido anulado y mesa liberada" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
  }
}
