import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Obtenemos todos los pedidos con su fecha y total
    const pedidos = await prisma.pedido.findMany({
      select: {
        fecha_creacion: true,
        total: true
      }
    });

    // 2. Inicializamos un array de 24 posiciones (una por cada hora del día)
    const ventasPorHora = Array.from({ length: 24 }, (_, i) => ({
      hora: `${i}:00`,
      cantidad: 0,
      montoTotal: 0
    }));

    // 3. Procesamos los pedidos para agruparlos
    pedidos.forEach(pedido => {
        // Verificamos que la fecha no sea nula antes de proceder
        if (pedido.fecha_creacion) {
            // Si ya es un objeto Date (lo que devuelve Prisma), usamos getHours() directo
            // Si llega como string por alguna razón, usamos new Date(pedido.fecha_creacion)
            const fecha = pedido.fecha_creacion instanceof Date 
            ? pedido.fecha_creacion 
            : new Date(pedido.fecha_creacion);

            const hora = fecha.getHours();
            
            // Validamos que la hora esté en el rango 0-23
            if (hora >= 0 && hora < 24) {
            ventasPorHora[hora].cantidad += 1;
            ventasPorHora[hora].montoTotal += Number(pedido.total || 0);
            }
        }
    });

    // 4. Identificamos la hora de mayor venta (Pico)
    const horaPico = [...ventasPorHora].sort((a, b) => b.cantidad - a.cantidad)[0];

    return NextResponse.json({
      ventasPorHora,
      resumen: {
        horaMasFrecuente: horaPico.hora,
        maxPedidos: horaPico.cantidad
      }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al procesar reporte' }, { status: 500 });
  }
}