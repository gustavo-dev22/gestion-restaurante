import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const mesas = await prisma.mesa.findMany({
      include: {
        // Traemos el pedido que esté 'Pendiente' para esta mesa
        pedidos: {
          where: { estado: 'Pendiente' },
          select: { nombreMesero: true, usuarioId: true },
          take: 1
        }
      },
      orderBy: { numero: 'asc' }
    });

    // Formateamos la respuesta para que el frontend la lea fácil
    const resultado = mesas.map(m => ({
      ...m,
      meseroNombre: m.pedidos[0]?.nombreMesero || null,
      meseroId: m.pedidos[0]?.usuarioId || null
    }));

    return NextResponse.json(resultado);
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const nueva = await prisma.mesa.create({
      data: {
        numero: body.numero,
        capacidad: parseInt(body.capacidad),
        zona: body.zona,
        estado: 'Libre',
        fecha_creacion: new Date()
      }
    });
    return NextResponse.json(nueva);
  } catch {
    return NextResponse.json({ error: 'Error al crear mesa' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const actualizada = await prisma.mesa.update({
      where: { id: Number(body.id) },
      data: {
        numero: body.numero,
        capacidad: parseInt(body.capacidad),
        zona: body.zona,
        estado: body.estado
      }
    });
    return NextResponse.json(actualizada);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { id: Number(id) }
    });

    if (mesa?.estado === 'Ocupada') {
      return NextResponse.json({ 
        success: false, 
        message: 'No puedes eliminar una mesa OCUPADA. Debe estar Libre para proceder.' 
      });
    }

    await prisma.mesa.update({
      where: { id: Number(id) },
      data: { activo: false }
    });
    
    return NextResponse.json({ success: true, message: 'Mesa eliminada con éxito' });
  } catch {
    return NextResponse.json({ success: false, message: 'Error al intentar eliminar la mesa' });
  }
}