import { NextResponse } from "next/server";
import { registrarMovimiento } from "@/lib/caja";
import {
  authorizeCash,
  cajaErrorResponse,
  revalidateCaja,
} from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeCash(request, CASH_PATHS.movimientos, "CREAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const turnoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { tipo?: unknown; monto?: unknown; motivo?: unknown }
        | null;

      const movimiento = await registrarMovimiento(
        auth,
        turnoId,
        body?.tipo,
        body?.monto,
        body?.motivo
      );
      revalidateCaja();
      return NextResponse.json({ success: true, movimiento });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
