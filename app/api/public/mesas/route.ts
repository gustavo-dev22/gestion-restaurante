import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const mesas = await prisma.mesa.findMany({
      where: { activo: true },
      select: {
        id: true,
        numero: true,
        zona: true,
        capacidad: true,
        estado: true,
      },
      orderBy: { numero: "asc" },
    });

    return NextResponse.json(mesas);
  } catch {
    return NextResponse.json({ error: "Error al obtener mesas" }, { status: 500 });
  }
}
