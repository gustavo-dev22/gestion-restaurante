import { NextResponse } from "next/server";
import { cerrarTurno } from "@/lib/caja";
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
    const auth = await authorizeCash(request, CASH_PATHS.turno, "EDITAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const turnoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { efectivoContado?: unknown; justificacion?: unknown }
        | null;

      const turno = await cerrarTurno(
        auth,
        turnoId,
        body?.efectivoContado,
        body?.justificacion
      );
      revalidateCaja();
      return NextResponse.json({ success: true, turno });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
