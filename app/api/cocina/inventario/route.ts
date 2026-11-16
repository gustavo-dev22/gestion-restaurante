import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { actorFromSession, auditLogSafe, getAuditContext } from '@/lib/audit';
import { authorizeLocal } from '@/lib/rbac';
import { parseJson, idSchema } from '@/lib/api-validation';
import { z } from 'zod';

const inventarioSchema = z.object({ id: idSchema, activo: z.boolean() });

// GET: Obtener todos los productos para el monitor de cocina
export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      include: { categoria: true },
      orderBy: { categoriaId: 'asc' }
    });
    return NextResponse.json(productos);
  } catch {
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 });
  }
}

// PATCH: Cambiar estado del producto (Campo 'activo' en tu DB)
export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "stock:adjust");
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await parseJson(request, inventarioSchema);
    if (!parsed.success) return parsed.response;
    const { id, activo } = parsed.data;
    const antes = await prisma.producto.findUnique({ where: { id } });
    const actualizado = await prisma.producto.update({
      where: { id },
      data: { activo }
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "stock.toggle",
        entidad: "Producto",
        entidadId: actualizado.id,
        antes,
        despues: actualizado,
        motivo: `Disponibilidad: ${actualizado.activo ? "activo" : "inactivo"}`,
      },
      getAuditContext(request)
    );

    return NextResponse.json(actualizado);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}