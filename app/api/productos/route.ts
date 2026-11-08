import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      include: {
        categoria: true // <--- Esto trae el nombre y datos de la categoría
      },
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const nuevoProducto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        precio: parseFloat(body.precio), // Asegura que sea decimal
        stock: parseInt(body.stock) || 0, // Asegura que sea entero
        categoriaId: parseInt(body.categoriaId), // Relación con Categorías
        imagen_url: body.imagen_url || null,
        activo: true
      }
    });

    return NextResponse.json(nuevoProducto);
  } catch (error: any) {
    console.error("Error al crear producto:", error);
    return NextResponse.json({ error: 'Error al guardar en SQL Server' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const actualizada = await prisma.producto.update({
      where: { id: Number(body.id) },
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        precio: parseFloat(body.precio),
        stock: parseInt(body.stock),
        categoriaId: parseInt(body.categoriaId),
        imagen_url: body.imagen_url || null, // Actualizamos la imagen
      }
    });
    return NextResponse.json(actualizada);
  } catch (error) {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Actualizamos el estado a inactivo
    await prisma.producto.update({
      where: { id: Number(id) },
      data: { activo: false }
    });

    return NextResponse.json({ message: 'Producto desactivado' });
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}