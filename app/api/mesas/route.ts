import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";

export async function GET() {
  try {
    const mesas = await prisma.mesa.findMany({
      include: {
        pedidos: {
          where: { estado: "Pendiente" },
          select: { nombreMesero: true, usuarioId: true },
          take: 1,
        },
      },
      orderBy: { numero: "asc" },
    });

    const resultado = mesas.map((mesa) => ({
      ...mesa,
      meseroNombre: mesa.pedidos[0]?.nombreMesero || null,
      meseroId: mesa.pedidos[0]?.usuarioId || null,
    }));

    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "tables:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const nueva = await prisma.mesa.create({
      data: {
        numero: body.numero,
        capacidad: parseInt(body.capacidad),
        zona: body.zona,
        estado: "Libre",
        fecha_creacion: new Date(),
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "table.create",
        entidad: "Mesa",
        entidadId: nueva.id,
        despues: nueva,
      },
      getAuditContext(request)
    );

    return NextResponse.json(nueva);
  } catch {
    return NextResponse.json({ error: "Error al crear mesa" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "tables:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = Number(body.id);
    const antes = await prisma.mesa.findUnique({ where: { id } });
    const actualizada = await prisma.mesa.update({
      where: { id },
      data: {
        numero: body.numero,
        capacidad: parseInt(body.capacidad),
        zona: body.zona,
        estado: body.estado,
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "table.update",
        entidad: "Mesa",
        entidadId: actualizada.id,
        antes,
        despues: actualizada,
      },
      getAuditContext(request)
    );

    return NextResponse.json(actualizada);
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeLocal(request, "tables:manage");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { id: Number(id) },
    });

    if (mesa?.estado === "Ocupada") {
      return NextResponse.json({
        success: false,
        message: "No puedes eliminar una mesa OCUPADA. Debe estar Libre para proceder.",
      });
    }

    await prisma.mesa.update({
      where: { id: Number(id) },
      data: { activo: false },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "table.deactivate",
        entidad: "Mesa",
        entidadId: id,
        antes: mesa,
        despues: { id: Number(id), activo: false },
        motivo: "Desactivación de mesa",
      },
      getAuditContext(request)
    );

    return NextResponse.json({ success: true, message: "Mesa eliminada con éxito" });
  } catch {
    return NextResponse.json({ success: false, message: "Error al intentar eliminar la mesa" });
  }
}
