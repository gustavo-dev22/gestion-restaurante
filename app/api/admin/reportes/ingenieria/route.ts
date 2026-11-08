import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Obtener ventas totales por producto
    const ventas = await prisma.pedidoDetalle.groupBy({
      by: ['productoId'],
      _sum: {
        cantidad: true,
      }
    });

    // 2. Traer info de productos (incluyendo precio y costo si lo tuvieras)
    // Nota: Como en tu tabla 'Producto' quizás no tengas 'costo', 
    // simularemos una rentabilidad del 40% para el ejemplo, 
    // pero lo ideal es que 'Producto' tenga un campo 'costo_insumos'.
    const productos = await prisma.producto.findMany();

    const totalVendido = ventas.reduce((acc, v) => acc + (v._sum.cantidad || 0), 0);
    const promedioVentas = totalVendido / productos.length;

    const matriz = productos.map(prod => {
      const ventaProd = ventas.find(v => v.productoId === prod.id);
      const cantidad = ventaProd?._sum.cantidad || 0;
      
      // Lógica de rentabilidad (Precio - Costo)
      // Si no tienes campo costo, aquí simulamos:
      const costoSimulado = Number(prod.precio) * 0.6; 
      const margen = Number(prod.precio) - costoSimulado;

      // Clasificación
      let categoria = "";
      const esPopular = cantidad >= promedioVentas;
      const esRentable = margen > (Number(prod.precio) * 0.3); // Ejemplo: margen > 30%

      if (esPopular && esRentable) categoria = "ESTRELLA";
      else if (esPopular && !esRentable) categoria = "CABALLO";
      else if (!esPopular && esRentable) categoria = "ROMPECABEZAS";
      else categoria = "PERRO";

      return {
        id: prod.id,
        nombre: prod.nombre,
        cantidad,
        margen: margen.toFixed(2),
        clasificacion: categoria
      };
    });

    return NextResponse.json({
      matriz,
      promedioVentas: promedioVentas.toFixed(2)
    });
  } catch (error) {
    return NextResponse.json({ error: 'Error al calcular matriz' }, { status: 500 });
  }
}