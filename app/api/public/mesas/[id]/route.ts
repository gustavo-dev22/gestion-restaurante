import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Definimos que params es una Promesa de un objeto que tiene id
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  try {
    // 1. Resolvemos la promesa de params
    const resolvedParams = await params;
    const idMesa = parseInt(resolvedParams.id);

    if (isNaN(idMesa)) {
      return NextResponse.json({ error: 'ID de mesa no válido' }, { status: 400 });
    }

    // 2. Buscamos la mesa
    const mesa = await prisma.mesa.findUnique({
      where: { id: idMesa },
      select: { 
        id: true, 
        numero: true, 
        estado: true 
      }
    });

    if (!mesa) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    return NextResponse.json(mesa);
  } catch (error: any) {
    console.error("DEBUG ERROR MESA:", error.message);
    return NextResponse.json({ 
      error: 'Error interno', 
      detalle: error.message 
    }, { status: 500 });
  }
}