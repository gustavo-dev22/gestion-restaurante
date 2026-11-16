import { NextResponse } from "next/server";
import { registrarMovimiento } from "@/lib/caja";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeLocal(request, "caja:movements");
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
        body?.motivo,
        getAuditContext(request)
      );
      revalidateCaja();
      return NextResponse.json({ success: true, movimiento });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
