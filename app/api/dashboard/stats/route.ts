import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [totalCategorias, totalProductos, stockBajo, mesas] = await Promise.all([
      prisma.categoria.count({ where: { activo: true } }),
      prisma.producto.count({ where: { activo: true } }),
      prisma.producto.count({ where: { activo: true, stock: { lt: 10 } } }),
      prisma.mesa.findMany({ where: { activo: true } })
    ]);

    const stats = {
      categorias: totalCategorias,
      productos: totalProductos,
      stockBajo: stockBajo,
      mesasTotal: mesas.length,
      mesasLibres: mesas.filter(m => m.estado === 'Libre').length,
      mesasOcupadas: mesas.filter(m => m.estado === 'Ocupada').length,
    };

    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}