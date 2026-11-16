import { NextResponse } from "next/server";
import { conciliarPagos } from "@/lib/caja";
import {
  authorizeCash,
  cajaErrorResponse,
  revalidateCaja,
} from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";
import { withIdempotency } from "@/lib/idempotency";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeCash(request, CASH_PATHS.turno, "EDITAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const turnoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { pagoIds?: unknown }
        | null;

      const resultado = await conciliarPagos(auth, turnoId, body?.pagoIds);
      revalidateCaja();
      return NextResponse.json({ success: true, ...resultado });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
