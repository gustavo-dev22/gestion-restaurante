import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  try {
    const { id, activo } = await request.json();
    const actualizado = await prisma.producto.update({
      where: { id: Number(id) },
      data: { activo: Boolean(activo) }
    });
    return NextResponse.json(actualizado);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}