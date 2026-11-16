import { NextResponse } from "next/server";
import { aplicarDescuento, getCuentaPedido } from "@/lib/cobros";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { parseJson, descuentoSchema } from "@/lib/api-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(
    request,
    async () => {
      const auth = await authorizeLocal(request, "payments:discount");
      if (auth instanceof NextResponse) return auth;

      try {
        const { id } = await params;
        const pedidoId = Number(id);
        const parsed = await parseJson(request, descuentoSchema);
        if (!parsed.success) return parsed.response;

        await aplicarDescuento(
          auth,
          pedidoId,
          parsed.data,
          getAuditContext(request)
        );
        revalidateCaja();
        return NextResponse.json({
          success: true,
          message: "Descuento aplicado",
          cuenta: await getCuentaPedido(pedidoId),
        });
      } catch (error) {
        return cajaErrorResponse(error);
      }
    },
    { scope: "payment:discount" }
  );
}
