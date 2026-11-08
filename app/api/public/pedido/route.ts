import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const ESTADOS_ACTIVOS = ['Por Confirmar', 'Pendiente'];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesaId = Number(searchParams.get('mesaId'));

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ error: 'mesaId inválido' }, { status: 400 });
    }

    const pedido = await prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: { in: ESTADOS_ACTIVOS },
      },
      include: {
        mesa: true,
        detalles: { include: { producto: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
    });

    return NextResponse.json(pedido ?? null);
  } catch {
    return NextResponse.json({ error: 'Error al consultar el pedido' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { mesaId, items, total } = await request.json();

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el pedido (Estado inicial: 'Por Confirmar')
      const nuevoPedido = await tx.pedido.create({
        data: {
          mesaId: Number(mesaId),
          total: total,
          estado: 'Por Confirmar', // Estado especial para que el mesero lo acepte
          nombreMesero: 'Cliente (Digital)',
          detalles: {
            create: items.map((item: any) => ({
              productoId: item.id,
              cantidad: item.cantidad,
              precio_unitario: item.precio
            }))
          }
        }
      });

      const mesaActual = await tx.mesa.findUnique({ where: { id: Number(mesaId) } });
      if (mesaActual?.estado !== 'Libre') {
        throw new Error("La mesa ya no está disponible");
      }

      // 2. Marcar mesa como Ocupada
      await tx.mesa.update({
        where: { id: Number(mesaId) },
        data: { estado: 'Ocupada' }
      });

      return nuevoPedido;
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    // Esto imprimirá el error real en tu terminal de VS Code
    console.error("ERROR PRISMA:", error.message);
    return NextResponse.json({ error: 'Error al procesar pedido', details: error.message }, { status: 500 });
  }
}