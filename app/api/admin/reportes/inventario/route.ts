import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Productos con stock crítico (suponiendo que tienes un campo stock y stockMinimo)
    // Si no tienes stockMinimo, usaremos un valor constante (ej. menos de 10 unidades)
    const inventarioCritico = await prisma.producto.findMany({
      where: {
        stock: { lte: 10 } // Productos con 10 o menos unidades
      },
      include: { categoria: true },
      orderBy: { stock: 'asc' }
    });

    // 2. Valorización de Inventario Total
    const todosLosProductos = await prisma.producto.findMany();
    const valorTotalInventario = todosLosProductos.reduce((acc, p) => {
        const costoSimulado = Number(p.precio) * 0.4;
      return acc + (Number(p.stock) * costoSimulado);
    }, 0);

    return NextResponse.json({
      critico: inventarioCritico,
      resumen: {
        totalProductosCriticos: inventarioCritico.length,
        valorizacionBodega: valorTotalInventario.toFixed(2)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener inventario' }, { status: 500 });
  }
}