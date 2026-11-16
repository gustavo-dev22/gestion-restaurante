import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { parseJson, cuponSchema, cuponUpdateSchema } from "@/lib/api-validation";
import { parseLimaDateTime } from "@/lib/utils";

export async function GET() {
  try {
    const cupones = await prisma.cupon.findMany({ orderBy: { id: "desc" } });
    return NextResponse.json(cupones);
  } catch {
    return NextResponse.json({ error: "Error al obtener cupones" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, cuponSchema);
  if (!parsed.success) return parsed.response;

  const desde = parsed.data.validoDesde
    ? parseLimaDateTime(parsed.data.validoDesde)
    : null;
  const hasta = parsed.data.validoHasta
    ? parseLimaDateTime(parsed.data.validoHasta)
    : null;
  if (parsed.data.validoDesde && !desde) {
    return NextResponse.json({ error: "FECHA_INVALIDA" }, { status: 400 });
  }
  if (parsed.data.validoHasta && !hasta) {
    return NextResponse.json({ error: "FECHA_INVALIDA" }, { status: 400 });
  }

  try {
    const cupon = await prisma.cupon.create({
      data: {
        codigo: parsed.data.codigo.toUpperCase(),
        tipo: parsed.data.tipo,
        valor: parsed.data.valor,
        validoDesde: desde,
        validoHasta: hasta,
        usosMaximos: parsed.data.usosMaximos ?? null,
        activo: parsed.data.activo ?? true,
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "coupon.create",
        entidad: "Cupon",
        entidadId: cupon.id,
        despues: cupon,
      },
      getAuditContext(request)
    );

    return NextResponse.json(cupon);
  } catch {
    return NextResponse.json({ error: "No se pudo crear el cupón" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, cuponUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id, ...data } = parsed.data;
    const antes = await prisma.cupon.findUnique({ where: { id } });
    const cupon = await prisma.cupon.update({
      where: { id },
      data: {
        ...data,
        ...(data.codigo ? { codigo: data.codigo.toUpperCase() } : {}),
        ...(data.validoDesde !== undefined
          ? {
              validoDesde: data.validoDesde
                ? parseLimaDateTime(data.validoDesde)
                : null,
            }
          : {}),
        ...(data.validoHasta !== undefined
          ? {
              validoHasta: data.validoHasta
                ? parseLimaDateTime(data.validoHasta)
                : null,
            }
          : {}),
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "coupon.update",
        entidad: "Cupon",
        entidadId: cupon.id,
        antes,
        despues: cupon,
      },
      getAuditContext(request)
    );

    return NextResponse.json(cupon);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el cupón" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
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

  const antes = await prisma.cupon.findUnique({ where: { id } });
  if (!antes) {
    return NextResponse.json({ error: "CUPON_NO_ENCONTRADO" }, { status: 404 });
  }

  const cupon = await prisma.cupon.update({
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
      accion: "coupon.deactivate",
      entidad: "Cupon",
      entidadId: cupon.id,
      antes,
      despues: cupon,
      motivo,
    },
    getAuditContext(request)
  );

  return NextResponse.json({ success: true, cupon });
}
