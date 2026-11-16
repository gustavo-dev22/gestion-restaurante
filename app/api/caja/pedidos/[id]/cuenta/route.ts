import { NextResponse } from "next/server";
import { getCuentaPedido } from "@/lib/cobros";
import { authorizeCashAny, cajaErrorResponse } from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeCashAny(
    request,
    [CASH_PATHS.turno, CASH_PATHS.historial],
    "LISTAR"
  );
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const pedidoId = Number(id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return NextResponse.json(
        { error: "PEDIDO_INVALIDO", message: "Pedido inválido." },
        { status: 400 }
      );
    }

    const cuenta = await getCuentaPedido(pedidoId);
    if (!cuenta) {
      return NextResponse.json(
        { error: "PEDIDO_NO_ENCONTRADO", message: "Pedido no encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json(cuenta);
  } catch (error) {
    return cajaErrorResponse(error);
  }
}
