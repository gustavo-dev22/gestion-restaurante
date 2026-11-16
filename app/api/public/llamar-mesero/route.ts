import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { parseJson, parseQuery, idSchema, llamadoSchema } from "@/lib/api-validation";
import { ACTIVE_ORDER_STATUSES } from "@/lib/order-status";
import { auditLogSafe, getAuditContext } from "@/lib/audit";

const DOS_MINUTOS_MS = 2 * 60 * 1000;
const VENTANA_CONSULTA_MS = 30 * 60 * 1000;

const querySchema = z.object({
  mesaId: idSchema,
  id: idSchema.optional(),
});

function mapLlamado(llamado: {
  id: number;
  estado: string;
  nombreMesero: string | null;
  creadoEn: Date;
}) {
  return {
    id: llamado.id,
    estado: llamado.estado,
    nombreMesero: llamado.nombreMesero,
    creadoEn: llamado.creadoEn.toISOString(),
    fecha_creacion: llamado.creadoEn.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseQuery(searchParams, querySchema);
  if (!parsed.success) return parsed.response;

  try {
    const llamado = parsed.data.id
      ? await prisma.llamadoMesero.findFirst({
          where: {
            id: parsed.data.id,
            mesaId: parsed.data.mesaId,
            estado: { in: ["PENDIENTE", "ATENDIDO"] },
          },
          select: { id: true, estado: true, nombreMesero: true, creadoEn: true },
        })
      : await prisma.llamadoMesero.findFirst({
          where: {
            mesaId: parsed.data.mesaId,
            estado: { in: ["PENDIENTE", "ATENDIDO"] },
            creadoEn: { gte: new Date(Date.now() - VENTANA_CONSULTA_MS) },
          },
          select: { id: true, estado: true, nombreMesero: true, creadoEn: true },
          orderBy: { creadoEn: "desc" },
        });

    return NextResponse.json(llamado ? mapLlamado(llamado) : null);
  } catch {
    return NextResponse.json({ error: "Error al consultar el llamado" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(`public:llamar:${getClientIp(request)}`, 5, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { success: false, message: "Demasiadas solicitudes. Espera un momento." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }

  const parsed = await parseJson(request, llamadoSchema);
  if (!parsed.success) return parsed.response;

  try {
    const mesa = await prisma.mesa.findUnique({
      where: { id: parsed.data.mesaId },
      select: { id: true },
    });
    if (!mesa) {
      return NextResponse.json({ success: false, message: "Mesa no encontrada." }, { status: 404 });
    }

    const pedidoActivo = await prisma.pedido.findFirst({
      where: {
        mesaId: parsed.data.mesaId,
        estado: { in: [...ACTIVE_ORDER_STATUSES] },
        usuarioId: { not: null },
      },
      select: { usuarioId: true, nombreMesero: true },
      orderBy: { fecha_creacion: "desc" },
    });

    const responsable = pedidoActivo?.usuarioId
      ? { usuarioId: pedidoActivo.usuarioId, nombreMesero: pedidoActivo.nombreMesero }
      : null;

    const reciente = await prisma.llamadoMesero.findFirst({
      where: {
        mesaId: parsed.data.mesaId,
        estado: "PENDIENTE",
        creadoEn: { gte: new Date(Date.now() - DOS_MINUTOS_MS) },
      },
      select: { id: true, usuarioId: true },
      orderBy: { creadoEn: "desc" },
    });

    if (reciente) {
      if (!reciente.usuarioId && responsable) {
        await prisma.llamadoMesero.update({
          where: { id: reciente.id },
          data: responsable,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Tu solicitud ya fue registrada. Un mesero se acercará pronto.",
        solicitudId: reciente.id,
      });
    }

    const solicitud = await prisma.llamadoMesero.create({
      data: {
        mesaId: parsed.data.mesaId,
        estado: "PENDIENTE",
        usuarioId: responsable?.usuarioId ?? null,
        nombreMesero: responsable?.nombreMesero ?? "Sin asignar",
      },
      select: { id: true },
    });

    await auditLogSafe(
      {
        accion: "call.create",
        entidad: "LlamadoMesero",
        entidadId: solicitud.id,
        despues: { mesaId: parsed.data.mesaId, solicitudId: solicitud.id },
        motivo: "Solicitud de mesero desde la mesa",
      },
      getAuditContext(request)
    );

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
