import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RESERVA_VENTANA_MS = 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesaId = Number(searchParams.get("mesaId"));
    const fechaParam = searchParams.get("fecha");

    if (!mesaId || Number.isNaN(mesaId) || !fechaParam) {
      return NextResponse.json({ disponible: false, message: "Parámetros inválidos." }, { status: 400 });
    }

    const fecha = new Date(fechaParam);
    if (Number.isNaN(fecha.getTime())) {
      return NextResponse.json({ disponible: false, message: "Fecha inválida." }, { status: 400 });
    }

    const conflicto = await prisma.reserva.findFirst({
      where: {
        mesaId,
        estado: "Confirmada",
        fechaReserva: {
          gte: new Date(fecha.getTime() - RESERVA_VENTANA_MS),
          lte: new Date(fecha.getTime() + RESERVA_VENTANA_MS),
        },
      },
      select: { id: true, fechaReserva: true },
    });

    return NextResponse.json({
      disponible: !conflicto,
      message: conflicto
        ? "La mesa ya tiene una reserva cerca de ese horario."
        : "Mesa disponible en ese horario.",
    });
  } catch {
    return NextResponse.json(
      { disponible: false, message: "No se pudo verificar la disponibilidad." },
      { status: 500 }
    );
  }
}
