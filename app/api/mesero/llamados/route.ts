import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const isAdmin = session.sections.includes("admin");

    const llamados = await prisma.pedido.findMany({
      where: isAdmin
        ? { estado: "Llamado" }
        : {
            estado: "Llamado",
            // Solo los llamados del mesero responsable o los que aún no tienen
            // responsable (mesa sin pedido activo asignado).
            OR: [{ usuarioId: session.sub }, { usuarioId: null }],
          },
      include: { mesa: true },
      orderBy: { fecha_creacion: "asc" },
    });

    return NextResponse.json(llamados);
  } catch {
    return NextResponse.json({ error: "Error al obtener llamados" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { pedidoId } = await request.json();
    const id = Number(pedidoId);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    const llamado = await prisma.pedido.findUnique({
      where: { id },
      select: { estado: true, usuarioId: true, nombreMesero: true },
    });

    if (!llamado || llamado.estado !== "Llamado") {
      return NextResponse.json({ error: "Solicitud no encontrada o ya atendida" }, { status: 404 });
    }

    const isAdmin = session.sections.includes("admin");
    if (!isAdmin && llamado.usuarioId && llamado.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Esta solicitud pertenece a otro mesero." },
        { status: 403 }
      );
    }

    const atendido = await prisma.pedido.update({
      where: { id },
      data: {
        estado: "Atendido",
        // Si no tenía responsable, queda registrado quién la atendió.
        usuarioId: llamado.usuarioId ?? session.sub,
        nombreMesero: llamado.usuarioId ? llamado.nombreMesero : session.nombre,
      },
    });

    return NextResponse.json(atendido);
  } catch {
    return NextResponse.json({ error: "Error al atender el llamado" }, { status: 500 });
  }
}
