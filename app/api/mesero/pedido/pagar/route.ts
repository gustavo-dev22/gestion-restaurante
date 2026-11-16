import { NextResponse } from "next/server";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { registrarPago } from "@/lib/payments";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { withIdempotency } from "@/lib/idempotency";

export async function PATCH(request: Request) {
  return withIdempotency(request, async () => {
    const session = await authorizeLocal(request, "payments:create");
    if (session instanceof NextResponse) return session;

    try {
      const body = (await request.json().catch(() => null)) as
        | { pedidoId?: unknown; metodoPago?: unknown }
        | null;

      const resultado = await registrarPago({
        actor: session,
        pedidoId: Number(body?.pedidoId),
        metodo: String(body?.metodoPago ?? ""),
        allowAnyOrder: false,
        fullBalanceOnly: true,
        audit: getAuditContext(request),
      });

      revalidateCaja();

      return NextResponse.json({
        message: "Pago procesado y mesa liberada",
        ...resultado,
        metodoPago: resultado.metodo,
      });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
