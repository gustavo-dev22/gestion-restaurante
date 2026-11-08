import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOS_MINUTOS_MS = 2 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mesaId = Number(body?.mesaId);

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ success: false, message: "Mesa inválida." }, { status: 400 });
    }

    const mesa = await prisma.mesa.findUnique({ where: { id: mesaId }, select: { id: true } });
    if (!mesa) {
      return NextResponse.json({ success: false, message: "Mesa no encontrada." }, { status: 404 });
    }

    // Evita spam: si ya hay una solicitud reciente sin atender, no duplicamos.
    const reciente = await prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: "Llamado",
        fecha_creacion: { gte: new Date(Date.now() - DOS_MINUTOS_MS) },
      },
      select: { id: true },
    });

    if (reciente) {
      return NextResponse.json({
        success: true,
        message: "Tu solicitud ya fue registrada. Un mesero se acercará pronto.",
        solicitudId: reciente.id,
      });
    }

    // Se registra la solicitud usando el modelo de pedidos (estado "Llamado"),
    // sin afectar cocina ni ventas, que filtran por sus propios estados.
    const solicitud = await prisma.pedido.create({
      data: {
        mesaId,
        estado: "Llamado",
        total: 0,
        nombreMesero: "Cliente (Llamado)",
        fecha_creacion: new Date(),
      },
      select: { id: true },
    });

    return NextResponse.json({
      success: true,
      message: "Solicitud registrada. Un mesero se acercará a tu mesa.",
      solicitudId: solicitud.id,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "No se pudo registrar la solicitud." },
      { status: 500 }
    );
  }
}
