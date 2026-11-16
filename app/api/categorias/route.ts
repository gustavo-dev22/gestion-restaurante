import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import {
  parseJson,
  categoriaSchema,
  categoriaUpdateSchema,
} from "@/lib/api-validation";

export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { id: "asc" },
    });
    return NextResponse.json(categorias);
  } catch {
    return NextResponse.json({ error: "Error al consultar BD" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, categoriaSchema);
  if (!parsed.success) return parsed.response;

  try {
    const nueva = await prisma.categoria.create({
      data: {
        nombre: parsed.data.nombre,
        descripcion: parsed.data.descripcion ?? "",
        icono: parsed.data.icono || "Tag",
        area: parsed.data.area || "Cocina",
        activo: parsed.data.activo ?? true,
        fecha_creacion: new Date(),
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "category.create",
        entidad: "Categoria",
        entidadId: nueva.id,
        despues: nueva,
      },
      getAuditContext(request)
    );

    return NextResponse.json(nueva);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    return NextResponse.json({ error: "Error al insertar en la base de datos" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, categoriaUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id, ...data } = parsed.data;
    const antes = await prisma.categoria.findUnique({ where: { id } });
    const actualizada = await prisma.categoria.update({
      where: { id },
      data,
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "category.update",
        entidad: "Categoria",
        entidadId: actualizada.id,
        antes,
        despues: actualizada,
      },
      getAuditContext(request)
    );

    return NextResponse.json(actualizada);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    return NextResponse.json({ error: "No se pudo actualizar en SQL Server" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
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
    const conteoProductos = await prisma.producto.count({
      where: { categoriaId: id, activo: true },
    });

    if (conteoProductos > 0) {
      return NextResponse.json({
        success: false,
        message: `No se puede eliminar: esta categoría tiene ${conteoProductos} productos asociados.`,
      });
    }

    const antes = await prisma.categoria.findUnique({ where: { id } });
    await prisma.categoria.update({
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
        accion: "category.deactivate",
        entidad: "Categoria",
        entidadId: id,
        antes,
        despues: { id, activo: false, motivoEliminacion: motivo },
        motivo,
      },
      getAuditContext(request)
    );

    return NextResponse.json({ success: true, message: "Categoría desactivada correctamente" });
  } catch {
    return NextResponse.json({ success: false, message: "Error interno del servidor" });
  }
}
