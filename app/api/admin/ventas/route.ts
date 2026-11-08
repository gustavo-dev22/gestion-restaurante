import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { peruEndOfDay, peruStartOfDay } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('rango') || 'hoy';

    // Límites calculados en hora de Perú (UTC-05:00) como instantes reales.
    let fechaInicio: Date;
    let fechaFin: Date;

    if (filtro === 'ayer') {
      fechaInicio = peruStartOfDay(1);
      fechaFin = peruEndOfDay(1);
    } else if (filtro === 'semana') {
      fechaInicio = peruStartOfDay(7);
      fechaFin = new Date();
    } else if (filtro === 'mes') {
      fechaInicio = peruStartOfDay(30);
      fechaFin = new Date();
    } else {
      fechaInicio = peruStartOfDay(0);
      fechaFin = new Date();
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