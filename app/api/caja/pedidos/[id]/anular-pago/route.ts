import { NextResponse } from "next/server";
import { anularPago, getCuentaPedido } from "@/lib/cobros";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeLocal(request, "payments:void");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const pedidoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { pagoId?: unknown; motivo?: unknown }
        | null;

      await anularPago(auth, pedidoId, Number(body?.pagoId), body?.motivo, getAuditContext(request));
      revalidateCaja();
      return NextResponse.json({
        success: true,
        message: "Pago anulado",
        cuenta: await getCuentaPedido(pedidoId),
      });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
