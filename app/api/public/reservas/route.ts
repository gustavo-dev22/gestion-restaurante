import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLimaDateTime } from "@/lib/utils";
import { parseQuery, idSchema } from "@/lib/api-validation";
import { getFranjaInicio } from "@/lib/reservation-slot";
import { z } from "zod";

const querySchema = z.object({
  mesaId: idSchema,
  fecha: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(searchParams, querySchema);
  if (!parsed.success) {
    return NextResponse.json(
      { disponible: false, message: "Parámetros inválidos." },
      { status: 400 }
    );
  }

  const fecha = parseLimaDateTime(parsed.data.fecha);
  if (!fecha) {
    return NextResponse.json(
      { disponible: false, message: "Fecha inválida." },
      { status: 400 }
    );
  }

  try {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        mesaId: parsed.data.mesaId,
        estado: "Confirmada",
        franjaInicio: getFranjaInicio(fecha),
      },
      select: { id: true, fechaReserva: true },
    });

    return NextResponse.json({
      disponible: !conflicto,
      message: conflicto
        ? "La mesa ya tiene una reserva en esa franja."
        : "Mesa disponible en ese horario.",
    });
  } catch {
    return NextResponse.json(
      { disponible: false, message: "No se pudo verificar la disponibilidad." },
      { status: 500 }
    );
  }
}
