import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import { parseJson, mesaSchema, mesaUpdateSchema } from "@/lib/api-validation";
import { ACTIVE_ORDER_STATUSES } from "@/lib/order-status";

export async function GET() {
  try {
    const mesas = await prisma.mesa.findMany({
      include: {
        pedidos: {
          where: { estado: { in: [...ACTIVE_ORDER_STATUSES] } },
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

  const parsed = await parseJson(request, mesaSchema);
  if (!parsed.success) return parsed.response;

  try {
    const nueva = await prisma.mesa.create({
      data: {
        numero: parsed.data.numero,
        capacidad: parsed.data.capacidad ?? 2,
        zona: parsed.data.zona ?? null,
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

  const parsed = await parseJson(request, mesaUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id, ...data } = parsed.data;
    const antes = await prisma.mesa.findUnique({ where: { id } });
    const actualizada = await prisma.mesa.update({
      where: { id },
      data,
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
  const id = Number(searchParams.get("id"));
  const motivo = (searchParams.get("motivo") ?? "").trim();

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }
  if (motivo.length < 3) {
    return NextResponse.json(
      { error: "MOTIVO_REQUERIDO", message: "Indica el motivo de la eliminación." },
      { status: 400 }
    );
  }

  try {
    const mesa = await prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      return NextResponse.json({ success: false, message: "Mesa no encontrada." }, { status: 404 });
    }
    if (mesa.estado === "Ocupada") {
      return NextResponse.json({
        success: false,
        message: "No puedes eliminar una mesa OCUPADA. Debe estar Libre para proceder.",
      });
    }

    await prisma.mesa.update({
      where: { id },
      data: {
        activo: false,
        eliminadoEn: new Date(),
        eliminadoPorId: auth.sub,
        eliminadoPorNombre: auth.nombre,
        motivoEliminacion: motivo.slice(0, 300),
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "table.deactivate",
        entidad: "Mesa",
        entidadId: id,
        antes: mesa,
        despues: { id, activo: false, motivoEliminacion: motivo },
        motivo,
      },
      getAuditContext(request)
    );

    return NextResponse.json({ success: true, message: "Mesa eliminada con éxito" });
  } catch {
    return NextResponse.json({ success: false, message: "Error al intentar eliminar la mesa" });
  }
}
