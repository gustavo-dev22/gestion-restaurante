import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLimaDateTime } from "@/lib/utils";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { parseJson, reservaSchema } from "@/lib/api-validation";
import { getFranjaInicio } from "@/lib/reservation-slot";
import { Prisma } from "@prisma/client";
import { isUniqueConstraintError, withSerializableRetry } from "@/lib/concurrency";
import { auditLogSafe, getAuditContext } from "@/lib/audit";

class ReservaError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(`public:reservar:${getClientIp(request)}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "RATE_LIMIT", message: "Demasiadas solicitudes de reserva. Espera un momento." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const parsed = await parseJson(request, reservaSchema);
  if (!parsed.success) return parsed.response;

  const fecha = parseLimaDateTime(parsed.data.fechaReserva);
  if (!fecha) {
    return NextResponse.json(
      { error: "FECHA_INVALIDA", message: "Fecha inválida." },
      { status: 400 }
    );
  }
  if (fecha.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "FECHA_INVALIDA", message: "Selecciona una fecha y hora futura." },
      { status: 400 }
    );
  }

  const franjaInicio = getFranjaInicio(fecha);

  try {
    const nuevaReserva = await withSerializableRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const mesa = await tx.mesa.findUnique({
            where: { id: parsed.data.mesaId },
          });
          if (!mesa) {
            throw new ReservaError(404, "MESA_NO_ENCONTRADA", "Mesa no encontrada.");
          }
          if (mesa.estado === "Mantenimiento") {
            throw new ReservaError(
              409,
              "MESA_NO_DISPONIBLE",
              "La mesa se encuentra en mantenimiento."
            );
          }
          if (mesa.capacidad && parsed.data.numPersonas > mesa.capacidad) {
            throw new ReservaError(
              400,
              "CAPACIDAD_EXCEDIDA",
              `La mesa admite hasta ${mesa.capacidad} personas.`
            );
          }

          const conflicto = await tx.reserva.findFirst({
            where: {
              mesaId: parsed.data.mesaId,
              franjaInicio,
              estado: "Confirmada",
            },
            select: { id: true },
          });
          if (conflicto) {
            throw new ReservaError(
              409,
              "RESERVA_NO_DISPONIBLE",
              "Esa mesa ya tiene una reserva en esa franja. Elige otra hora o mesa."
            );
          }

          return tx.reserva.create({
            data: {
              clienteNombre: parsed.data.clienteNombre,
              clienteTelefono: parsed.data.clienteTelefono,
              fechaReserva: fecha,
              franjaInicio,
              numPersonas: parsed.data.numPersonas,
              mesaId: parsed.data.mesaId,
              estado: "Confirmada",
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    );

    await auditLogSafe(
      {
        accion: "reservation.create",
        entidad: "Reserva",
        entidadId: nuevaReserva.id,
        despues: nuevaReserva,
        motivo: "Reserva creada desde la web pública",
      },
      getAuditContext(request)
    );

    return NextResponse.json(nuevaReserva);
  } catch (error) {
    if (error instanceof ReservaError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        {
          error: "RESERVA_NO_DISPONIBLE",
          message: "La mesa ya tiene una reserva en esa franja.",
        },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Error al crear la reserva" }, { status: 500 });
  }
}
