import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import {
  parseJson,
  productoSchema,
  productoUpdateSchema,
} from "@/lib/api-validation";

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

  const parsed = await parseJson(request, productoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const nuevoProducto = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.create({
        data: {
          nombre: parsed.data.nombre,
          descripcion: parsed.data.descripcion ?? null,
          precio: parsed.data.precio,
          stock: parsed.data.stock ?? 0,
          categoriaId: parsed.data.categoriaId,
          imagen_url: parsed.data.imagen_url ?? null,
          activo: true,
          fecha_creacion: new Date(),
        },
      });

      await tx.productoPrecioHistorial.create({
        data: {
          productoId: producto.id,
          precioAnterior: null,
          precioNuevo: producto.precio,
          motivo: "Precio inicial",
          usuarioId: auth.sub,
          usuarioNombre: auth.nombre,
        },
      });

      return producto;
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

  const parsed = await parseJson(request, productoUpdateSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id, ...data } = parsed.data;
    const antes = await prisma.producto.findUnique({ where: { id } });
    if (!antes) {
      return NextResponse.json({ error: "PRODUCTO_NO_ENCONTRADO" }, { status: 404 });
    }

    const actualizada = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.update({
        where: { id },
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
          precio: data.precio,
          stock: data.stock ?? 0,
          categoriaId: data.categoriaId,
          imagen_url: data.imagen_url ?? null,
        },
      });

      if (Number(antes.precio) !== Number(producto.precio)) {
        await tx.productoPrecioHistorial.create({
          data: {
            productoId: producto.id,
            precioAnterior: antes.precio,
            precioNuevo: producto.precio,
            motivo: `Actualización de precio`,
            usuarioId: auth.sub,
            usuarioNombre: auth.nombre,
          },
        });
      }

      return producto;
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
  } catch (error) {
    console.error("Error al actualizar producto:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  try {
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

    const antes = await prisma.producto.findUnique({ where: { id } });
    if (!antes) {
      return NextResponse.json({ error: "PRODUCTO_NO_ENCONTRADO" }, { status: 404 });
    }

    await prisma.producto.update({
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
        accion: "product.deactivate",
        entidad: "Producto",
        entidadId: id,
        antes,
        despues: { id, activo: false, motivoEliminacion: motivo },
        motivo,
      },
      getAuditContext(request)
    );

    return NextResponse.json({ message: "Producto desactivado" });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}
