import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const llamados = await prisma.pedido.findMany({
      where: { estado: "Llamado" },
      include: { mesa: true },
      orderBy: { fecha_creacion: "asc" },
    });

    return NextResponse.json(llamados);
  } catch {
    return NextResponse.json({ error: "Error al obtener llamados" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { pedidoId } = await request.json();
    const id = Number(pedidoId);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
    }

    const llamado = await prisma.pedido.update({
      where: { id },
      data: { estado: "Atendido" },
    });

    return NextResponse.json(llamado);
  } catch {
    return NextResponse.json({ error: "Error al atender el llamado" }, { status: 500 });
  }
}
