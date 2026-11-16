import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";

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

  try {
    const body = await request.json();

    if (!body.nombre) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const nueva = await prisma.categoria.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || "",
        icono: body.icono || "Tag",
        area: body.area || "Cocina",
        activo: body.activo !== undefined ? body.activo : true,
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

  try {
    const body = await request.json();
    const { id, nombre, descripcion, icono, area, activo } = body;

    if (!id) {
      return NextResponse.json({ error: "ID no proporcionado" }, { status: 400 });
    }

    const antes = await prisma.categoria.findUnique({ where: { id: Number(id) } });
    const actualizada = await prisma.categoria.update({
      where: { id: Number(id) },
      data: {
        nombre,
        descripcion,
        icono,
        area,
        activo,
      },
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
  const id = searchParams.get("id");

  try {
    const conteoProductos = await prisma.producto.count({
      where: { categoriaId: Number(id) },
    });

    if (conteoProductos > 0) {
      return NextResponse.json({
        success: false,
        message: `No se puede eliminar: Esta categoría tiene ${conteoProductos} productos asociados.`,
      });
    }

    const antes = await prisma.categoria.findUnique({ where: { id: Number(id) } });
    await prisma.categoria.update({
      where: { id: Number(id) },
      data: { activo: false },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "category.deactivate",
        entidad: "Categoria",
        entidadId: id,
        antes,
        despues: { id: Number(id), activo: false },
        motivo: "Desactivación de categoría",
      },
      getAuditContext(request)
    );

    return NextResponse.json({ success: true, message: "Categoría desactivada correctamente" });
  } catch {
    return NextResponse.json({ success: false, message: "Error interno del servidor" });
  }
}
