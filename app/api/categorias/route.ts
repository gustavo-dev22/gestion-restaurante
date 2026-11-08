import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' }
    });
    return NextResponse.json(categorias);
  } catch {
    return NextResponse.json({ error: 'Error al consultar BD' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validación básica
    if (!body.nombre) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    const nueva = await prisma.categoria.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion || '',
        icono: body.icono || 'Tag',
        area: body.area || 'Cocina',
        activo: body.activo !== undefined ? body.activo : true,
        fecha_creacion: new Date(),
      }
    });

    return NextResponse.json(nueva);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    return NextResponse.json({ error: 'Error al insertar en la base de datos' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, nombre, descripcion, icono, area, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID no proporcionado' }, { status: 400 });
    }

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

    return NextResponse.json(actualizada);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    return NextResponse.json({ error: 'No se pudo actualizar en SQL Server' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  try {
    // 1. Verificar productos asociados
    const conteoProductos = await prisma.producto.count({
      where: { categoriaId: Number(id) }
    });

    if (conteoProductos > 0) {
      return NextResponse.json({ 
        success: false, 
        message: `No se puede eliminar: Esta categoría tiene ${conteoProductos} productos asociados.` 
      }); // Ya no enviamos status 400
    }

    // 2. Si está limpia, procedemos
    await prisma.categoria.update({
      where: { id: Number(id) },
      data: { activo: false }
    });

    return NextResponse.json({ success: true, message: 'Categoría desactivada correctamente' });
  } catch {
    return NextResponse.json({ success: false, message: 'Error interno del servidor' });
  }
}