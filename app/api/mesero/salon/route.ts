import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request) {
  try {
    const { mesaId, usuarioId, nombreMesero } = await request.json();

    if (!mesaId || !usuarioId) {
      return NextResponse.json({ error: 'Mesa ID o Usuario ID faltantes' }, { status: 400 });
    }

    // Usamos una transacción para que si algo falla, no cambie el estado de la mesa a medias
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Cambiar estado de la mesa a 'Ocupada'
      const mesaActualizada = await tx.mesa.update({
        where: { id: Number(mesaId) },
        data: { estado: 'Ocupada' }
      });

      // 2. Crear la cabecera del Pedido
      // Nota: Asegúrate de que tu esquema no pida 'usuarioId' como obligatorio
      const nuevoPedido = await tx.pedido.create({
        data: {
          mesaId: Number(mesaId),
          usuarioId: usuarioId,
          nombreMesero: nombreMesero,
          total: 0,
          estado: 'Pendiente'
        }
      });

      return { mesa: mesaActualizada, pedido: nuevoPedido };
    });

    return NextResponse.json(resultado);
  } catch (error: any) {
    // ESTO TE AYUDARÁ A VER EL ERROR REAL EN LA CONSOLA DE LA TERMINAL
    console.error("DETALLE DEL ERROR EN SQL SERVER:", error.message);
    return NextResponse.json({ 
      error: 'Error interno en el servidor', 
      details: error.message 
    }, { status: 500 });
  }
}