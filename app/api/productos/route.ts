import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";

export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: {
        categoria: true,
      },
      orderBy: { id: "desc" },
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return NextResponse.json({ error: "Error al consultar productos" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const nuevoProducto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        precio: parseFloat(body.precio),
        stock: parseInt(body.stock) || 0,
        categoriaId: parseInt(body.categoriaId),
        imagen_url: body.imagen_url || null,
        activo: true,
        fecha_creacion: new Date(),
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "product.create",
        entidad: "Producto",
        entidadId: nuevoProducto.id,
        despues: nuevoProducto,
      },
      getAuditContext(request)
    );

    return NextResponse.json(nuevoProducto);
  } catch (error) {
    console.error("Error al crear producto:", error);
    return NextResponse.json({ error: "Error al guardar en SQL Server" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const id = Number(body.id);
    const antes = await prisma.producto.findUnique({ where: { id } });

    const actualizada = await prisma.producto.update({
      where: { id },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        precio: parseFloat(body.precio),
        stock: parseInt(body.stock),
        categoriaId: parseInt(body.categoriaId),
        imagen_url: body.imagen_url || null,
      },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "product.update",
        entidad: "Producto",
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
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const antes = await prisma.producto.findUnique({ where: { id: Number(id) } });
    await prisma.producto.update({
      where: { id: Number(id) },
      data: { activo: false },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "product.deactivate",
        entidad: "Producto",
        entidadId: id,
        antes,
        despues: { id: Number(id), activo: false },
        motivo: "Desactivación desde la carta",
      },
      getAuditContext(request)
    );

    return NextResponse.json({ message: "Producto desactivado" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
