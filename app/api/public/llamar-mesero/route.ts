import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DOS_MINUTOS_MS = 2 * 60 * 1000;
const VENTANA_CONSULTA_MS = 30 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesaId = Number(searchParams.get("mesaId"));
    const id = Number(searchParams.get("id"));

    if (!mesaId || Number.isNaN(mesaId)) {
      return NextResponse.json({ error: "mesaId inválido" }, { status: 400 });
    }

    const llamado = id && !Number.isNaN(id)
      ? await prisma.pedido.findFirst({
          where: { id, mesaId, estado: { in: ["Llamado", "Atendido"] } },
          select: { id: true, estado: true, nombreMesero: true, fecha_creacion: true },
        })
      : await prisma.pedido.findFirst({
          where: {
            mesaId,
            estado: { in: ["Llamado", "Atendido"] },
            fecha_creacion: { gte: new Date(Date.now() - VENTANA_CONSULTA_MS) },
          },
          select: { id: true, estado: true, nombreMesero: true, fecha_creacion: true },
          orderBy: { fecha_creacion: "desc" },
        });

    return NextResponse.json(llamado ?? null);
  } catch {
    return NextResponse.json({ error: "Error al consultar el llamado" }, { status: 500 });
  }
}

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

    // Determina al mesero responsable de la mesa (pedido activo con mesero asignado).
    const pedidoActivo = await prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: { in: ["Por Confirmar", "Pendiente"] },
        usuarioId: { not: null },
      },
      select: { usuarioId: true, nombreMesero: true },
      orderBy: { fecha_creacion: "desc" },
    });

    const responsable = pedidoActivo?.usuarioId
      ? { usuarioId: pedidoActivo.usuarioId, nombreMesero: pedidoActivo.nombreMesero }
      : null;

    // Evita spam: si ya hay una solicitud reciente sin atender, no duplicamos.
    const reciente = await prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: "Llamado",
        fecha_creacion: { gte: new Date(Date.now() - DOS_MINUTOS_MS) },
      },
      select: { id: true, usuarioId: true },
      orderBy: { fecha_creacion: "desc" },
    });

    if (reciente) {
      // Si la solicitud aún no tenía responsable y ahora sí lo hay, se le asigna.
      if (!reciente.usuarioId && responsable) {
        await prisma.pedido.update({
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

    const solicitud = await prisma.pedido.create({
      data: {
        mesaId,
        estado: "Llamado",
        total: 0,
        usuarioId: responsable?.usuarioId ?? null,
        nombreMesero: responsable?.nombreMesero ?? "Sin asignar",
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
