import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import { parseJson, reservaEstadoSchema } from "@/lib/api-validation";
import { isUniqueConstraintError } from "@/lib/concurrency";

export async function GET() {
  try {
    const reservas = await prisma.reserva.findMany({
      include: { mesa: true },
      orderBy: { fechaReserva: "asc" },
    });
    return NextResponse.json(reservas);
  } catch {
    return NextResponse.json({ error: "Error al obtener reservas" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "reservations:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJson(request, reservaEstadoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const antes = await prisma.reserva.findUnique({ where: { id: parsed.data.id } });
    const reserva = await prisma.reserva.update({
      where: { id: parsed.data.id },
      data: { estado: parsed.data.nuevoEstado },
    });

    await auditLogSafe(
      {
        actor: actorFromSession(auth),
        accion: "reservation.update",
        entidad: "Reserva",
        entidadId: reserva.id,
        antes,
        despues: reserva,
        motivo: `Estado de reserva: ${parsed.data.nuevoEstado}`,
      },
      getAuditContext(request)
    );

    return NextResponse.json(reserva);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        {
          error: "RESERVA_NO_DISPONIBLE",
          message: "Ya existe una reserva confirmada para esa mesa y franja.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Error al actualizar reserva" }, { status: 500 });
  }
}
