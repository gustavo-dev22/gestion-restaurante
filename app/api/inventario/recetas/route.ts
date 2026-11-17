import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { parseJson, recetaSchema } from "@/lib/api-validation";

export async function GET(request: Request) {
  const auth = await authorizeLocal(request, "inventory:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const productoId = Number(searchParams.get("productoId"));
  const where =
    Number.isInteger(productoId) && productoId > 0 ? { productoId } : {};

  const recetas = await prisma.receta.findMany({
    where,
    include: {
      producto: { select: { id: true, nombre: true, precio: true, tipoInventario: true } },
      detalles: {
        include: {
          insumo: {
            include: { unidadBase: true },
          },
        },
      },
    },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(recetas);
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "inventory:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, recetaSchema);
  if (!parsed.success) return parsed.response;

  const insumoIds = parsed.data.detalles.map((detalle) => detalle.insumoId);
  if (new Set(insumoIds).size !== insumoIds.length) {
    return NextResponse.json(
      { error: "INSUMO_DUPLICADO", message: "No repitas el mismo insumo en la receta." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findUnique({
        where: { id: parsed.data.productoId },
      });
      if (!producto) {
        throw new Error("PRODUCTO_NO_ENCONTRADO");
      }

      const insumos = await tx.insumo.findMany({
        where: { id: { in: insumoIds }, activo: true },
        select: { id: true },
      });
      if (insumos.length !== insumoIds.length) {
        throw new Error("INSUMO_NO_ENCONTRADO");
      }

      const activo = parsed.data.activo ?? true;
      const receta = await tx.receta.upsert({
        where: { productoId: parsed.data.productoId },
        update: {
          rendimiento: parsed.data.rendimiento,
          mermaPorcentaje: parsed.data.mermaPorcentaje,
          activo,
        },
        create: {
          productoId: parsed.data.productoId,
          rendimiento: parsed.data.rendimiento,
          mermaPorcentaje: parsed.data.mermaPorcentaje,
          activo,
        },
      });

      await tx.recetaDetalle.deleteMany({ where: { recetaId: receta.id } });
      await tx.recetaDetalle.createMany({
        data: parsed.data.detalles.map((detalle) => ({
          recetaId: receta.id,
          insumoId: detalle.insumoId,
          cantidad: detalle.cantidad,
        })),
      });

      await tx.producto.update({
        where: { id: parsed.data.productoId },
        data: { tipoInventario: activo ? "RECETA" : "DIRECTO" },
      });

      return tx.receta.findUnique({
        where: { id: receta.id },
        include: {
          producto: { select: { id: true, nombre: true, tipoInventario: true } },
          detalles: { include: { insumo: { include: { unidadBase: true } } } },
        },
      });
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "inventory.recipe.save",
        entidad: "Receta",
        entidadId: parsed.data.productoId,
        despues: result,
      },
      getAuditContext(request)
    );

    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "PRODUCTO_NO_ENCONTRADO") {
      return NextResponse.json({ error: code }, { status: 404 });
    }
    if (code === "INSUMO_NO_ENCONTRADO") {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    return NextResponse.json({ error: "No se pudo guardar la receta" }, { status: 500 });
  }
}
