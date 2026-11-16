import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { parseJson, atenderLlamadoSchema } from "@/lib/api-validation";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";

export async function GET(request: Request) {
  const session = await authorizeLocal(request, "orders:serve");
  if (session instanceof NextResponse) return session;

  const isAdmin = session.sections.includes("admin");

  try {
    const llamados = await prisma.llamadoMesero.findMany({
      where: isAdmin
        ? { estado: "PENDIENTE" }
        : {
            estado: "PENDIENTE",
            OR: [{ usuarioId: session.sub }, { usuarioId: null }],
          },
      include: { mesa: { select: { id: true, numero: true } } },
      orderBy: { creadoEn: "asc" },
    });

    return NextResponse.json(llamados);
  } catch {
    return NextResponse.json({ error: "Error al obtener llamados" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await authorizeLocal(request, "orders:serve");
  if (session instanceof NextResponse) return session;

  const parsed = await parseJson(request, atenderLlamadoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const llamado = await prisma.llamadoMesero.findUnique({
      where: { id: parsed.data.llamadoId },
      select: { estado: true, usuarioId: true },
    });

    if (!llamado || llamado.estado !== "PENDIENTE") {
      return NextResponse.json(
        { error: "LLAMADO_NO_ENCONTRADO", message: "La solicitud ya fue atendida o no existe." },
        { status: 404 }
      );
    }

    const isAdmin = session.sections.includes("admin");
    if (!isAdmin && llamado.usuarioId && llamado.usuarioId !== session.sub) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Esta solicitud pertenece a otro mesero." },
        { status: 403 }
      );
    }

    const actualizado = await prisma.llamadoMesero.update({
      where: { id: parsed.data.llamadoId },
      data: {
        estado: "ATENDIDO",
        atendidoEn: new Date(),
        atendidoPorId: session.sub,
        atendidoPorNombre: session.nombre,
        ...(llamado.usuarioId ? {} : { usuarioId: session.sub, nombreMesero: session.nombre }),
      },
      include: { mesa: { select: { id: true, numero: true } } },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(session),
        accion: "call.attend",
        entidad: "LlamadoMesero",
        entidadId: actualizado.id,
        antes: { estado: "PENDIENTE", usuarioId: llamado.usuarioId },
        despues: {
          estado: actualizado.estado,
          atendidoPorId: actualizado.atendidoPorId,
          atendidoPorNombre: actualizado.atendidoPorNombre,
        },
        motivo: "Solicitud de mesero atendida",
      },
      getAuditContext(request)
    );

    return NextResponse.json(actualizado);
  } catch {
    return NextResponse.json({ error: "Error al atender el llamado" }, { status: 500 });
  }
}
