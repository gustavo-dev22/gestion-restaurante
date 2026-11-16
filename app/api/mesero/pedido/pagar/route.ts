import { NextResponse } from "next/server";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { registrarPago } from "@/lib/payments";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { withIdempotency } from "@/lib/idempotency";
import { parseJson, cobrarPedidoSchema } from "@/lib/api-validation";

export async function PATCH(request: Request) {
  return withIdempotency(
    request,
    async () => {
      const session = await authorizeLocal(request, "payments:create");
      if (session instanceof NextResponse) return session;

      try {
        const parsed = await parseJson(request, cobrarPedidoSchema);
        if (!parsed.success) return parsed.response;

        const resultado = await registrarPago({
          actor: session,
          pedidoId: parsed.data.pedidoId,
          metodo: parsed.data.metodoPago,
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
    },
    { required: true, scope: "payment:create" }
  );
}
