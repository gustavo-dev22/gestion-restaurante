import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      // Opcional: solo traer productos que tengan stock o estén activos
      orderBy: { nombre: 'asc' }
    });
    return NextResponse.json(productos);
  } catch (error) {
    return NextResponse.json({ error: 'Error al cargar productos' }, { status: 500 });
  }
}