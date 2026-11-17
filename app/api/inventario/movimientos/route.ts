import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import {
  parseJson,
  movimientoInsumoSchema,
} from "@/lib/api-validation";
import {
  InventoryError,
  registrarMovimientoInsumo,
} from "@/lib/inventory";
import { getAuditContext } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";

function permissionForType(tipo: string): string {
  if (tipo === "COMPRA") return "inventory:purchase";
  if (tipo === "MERMA") return "inventory:waste";
  if (tipo === "TRANSFERENCIA") return "inventory:transfer";
  return "inventory:count";
}

export async function GET(request: Request) {
  const auth = await authorizeLocal(request, "inventory:read");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const insumoId = Number(searchParams.get("insumoId"));
  const movimientos = await prisma.insumoMovimiento.findMany({
    where: Number.isInteger(insumoId) && insumoId > 0 ? { insumoId } : {},
    include: {
      insumo: { select: { nombre: true, unidadBase: { select: { codigo: true } } } },
      almacen: { select: { nombre: true } },
      almacenDestino: { select: { nombre: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(movimientos);
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, movimientoInsumoSchema);
  if (!parsed.success) return parsed.response;

  const auth = await authorizeLocal(request, permissionForType(parsed.data.tipo));
  if (auth instanceof NextResponse) return auth;

  try {
    const movimiento = await registrarMovimientoInsumo({
      actor: auth,
      insumoId: parsed.data.insumoId,
      almacenId: parsed.data.almacenId,
      almacenDestinoId: parsed.data.almacenDestinoId ?? null,
      tipo: parsed.data.tipo,
      cantidad: parsed.data.cantidad,
      costoUnitario: parsed.data.costoUnitario ?? 0,
      motivo: parsed.data.motivo ?? null,
      audit: getAuditContext(request),
    });

    revalidateTag(CACHE_TAGS.reports, "max");
    revalidateTag(CACHE_TAGS.dashboard, "max");
    return NextResponse.json({ success: true, movimiento });
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "No se pudo registrar el movimiento" }, { status: 500 });
  }
}
