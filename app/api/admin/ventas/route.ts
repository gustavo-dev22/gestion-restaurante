import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('rango') || 'hoy';

    // Calculamos la fecha de inicio según el filtro (Zona Horaria Local)
    let fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0); // Inicio de hoy

    let fechaFin = new Date(); // Por defecto, hasta ahora
    fechaFin.setHours(23, 59, 59, 999);

    if (filtro === 'ayer') {
      fechaInicio.setDate(fechaInicio.getDate() - 1);
      // El límite de 'ayer' es hoy a las 00:00:00
      fechaFin = new Date(fechaInicio);
      fechaFin.setHours(23, 59, 59, 999);
    } else if (filtro === 'semana') {
      fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else if (filtro === 'mes') {
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    }

    const ventas = await prisma.pedido.findMany({
      where: {
        estado: 'Pagado',
        fecha_creacion: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: {
        mesa: true,
        detalles: { include: { producto: true } }
      },
      orderBy: { fecha_creacion: 'desc' }
    });

    return NextResponse.json(ventas);
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener ventas' }, { status: 500 });
  }
}