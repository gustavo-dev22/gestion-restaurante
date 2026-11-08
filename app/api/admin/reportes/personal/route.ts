import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Agrupamos los pedidos por mesero
    const estadisticas = await prisma.pedido.groupBy({
      by: ['usuarioId', 'nombreMesero'],
      _sum: { total: true },
      _count: { id: true },
      // Solo tomamos pedidos finalizados o pagados si tuvieras ese estado
      where: {
        estado: 'Pagado',
        NOT: { usuarioId: null },
      }
    });

    // 2. Formateamos la data para el ranking
    const ranking = estadisticas.map(item => {
      const totalVendido = Number(item._sum.total || 0);
      const cantidadPedidos = item._count.id || 0;
      
      return {
        mesero: item.nombreMesero || 'Sin nombre',
        id: item.usuarioId,
        total: totalVendido,
        pedidos: cantidadPedidos,
        // Ticket Promedio: Total / Cantidad
        ticketPromedio: cantidadPedidos > 0 ? (totalVendido / cantidadPedidos).toFixed(2) : 0
      };
    }).sort((a, b) => b.total - a.total); // Ordenar por quien vendió más

    return NextResponse.json(ranking);
  } catch (error) {
    return NextResponse.json({ error: 'Error al generar ranking' }, { status: 500 });
  }
}