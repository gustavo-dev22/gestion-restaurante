import { NextResponse } from "next/server";
import { conciliarPagos } from "@/lib/caja";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeLocal(request, "payments:conciliate");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const turnoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { pagoIds?: unknown; devolucionIds?: unknown }
        | null;

      const resultado = await conciliarPagos(
        auth,
        turnoId,
        body?.pagoIds,
        body?.devolucionIds,
        getAuditContext(request)
      );
      revalidateCaja();
      return NextResponse.json({ success: true, ...resultado });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
