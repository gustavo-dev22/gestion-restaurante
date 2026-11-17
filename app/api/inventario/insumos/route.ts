import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { parseJson, insumoSchema, insumoUpdateSchema } from "@/lib/api-validation";

export async function GET(request: Request) {
  const auth = await authorizeLocal(request, "inventory:read");
  if (auth instanceof NextResponse) return auth;

  const insumos = await prisma.insumo.findMany({
    where: { activo: true },
    include: {
      unidadBase: true,
      stocks: { include: { almacen: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(
    insumos.map((insumo) => ({
      ...insumo,
      stockTotal: insumo.stocks.reduce((total, stock) => total + Number(stock.cantidad), 0),
    }))
  );
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "inventory:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, insumoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const unidad = await prisma.unidadMedida.findUnique({
      where: { id: parsed.data.unidadBaseId },
    });
    if (!unidad) {
      return NextResponse.json({ error: "UNIDAD_NO_ENCONTRADA" }, { status: 400 });
    }

    const insumo = await prisma.insumo.create({
      data: {
        nombre: parsed.data.nombre,
        unidadBaseId: parsed.data.unidadBaseId,
        stockMinimo: parsed.data.stockMinimo,
        puntoRecompra: parsed.data.puntoRecompra,
        leadTimeDias: parsed.data.leadTimeDias,
        costoPromedio: 0,
      },
      include: { unidadBase: true },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "inventory.item.create",
        entidad: "Insumo",
        entidadId: insumo.id,
        despues: insumo,
      },
      getAuditContext(request)
    );

    return NextResponse.json(insumo);
  } catch {
    return NextResponse.json({ error: "No se pudo crear el insumo" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "inventory:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, insumoUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id, ...data } = parsed.data;
    const antes = await prisma.insumo.findUnique({ where: { id } });
    if (!antes) {
      return NextResponse.json({ error: "INSUMO_NO_ENCONTRADO" }, { status: 404 });
    }

    const insumo = await prisma.insumo.update({
      where: { id },
      data,
      include: { unidadBase: true },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "inventory.item.update",
        entidad: "Insumo",
        entidadId: insumo.id,
        antes,
        despues: insumo,
      },
      getAuditContext(request)
    );

    return NextResponse.json(insumo);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el insumo" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeLocal(request, "inventory:manage");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  const motivo = (searchParams.get("motivo") ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || motivo.length < 3) {
    return NextResponse.json(
      { error: "MOTIVO_REQUERIDO", message: "Indica un motivo válido." },
      { status: 400 }
    );
  }

  const antes = await prisma.insumo.findUnique({ where: { id } });
  if (!antes) {
    return NextResponse.json({ error: "INSUMO_NO_ENCONTRADO" }, { status: 404 });
  }

  const insumo = await prisma.insumo.update({
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
      accion: "inventory.item.deactivate",
      entidad: "Insumo",
      entidadId: insumo.id,
      antes,
      despues: insumo,
      motivo,
    },
    getAuditContext(request)
  );

  return NextResponse.json({ success: true, insumo });
}
