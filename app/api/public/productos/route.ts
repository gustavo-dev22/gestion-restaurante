import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: { categoria: { select: { id: true, nombre: true, icono: true } } },
      orderBy: { nombre: 'asc' }
    });
    return NextResponse.json(productos);
  } catch (error) {
    return NextResponse.json({ error: 'Error al cargar productos' }, { status: 500 });
  }
}