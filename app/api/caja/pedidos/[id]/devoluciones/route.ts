import { NextResponse } from "next/server";
import { getCuentaPedido, registrarDevolucion } from "@/lib/cobros";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { parseJson, devolucionSchema } from "@/lib/api-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(
    request,
    async () => {
      const auth = await authorizeLocal(request, "payments:refund");
      if (auth instanceof NextResponse) return auth;

      try {
        const { id } = await params;
        const pedidoId = Number(id);
        const parsed = await parseJson(request, devolucionSchema);
        if (!parsed.success) return parsed.response;

        await registrarDevolucion(auth, pedidoId, {
          ...parsed.data,
          audit: getAuditContext(request),
        });
        revalidateCaja();
        return NextResponse.json({
          success: true,
          message: "Devolución registrada",
          cuenta: await getCuentaPedido(pedidoId),
        });
      } catch (error) {
        return cajaErrorResponse(error);
      }
    },
    { required: true, scope: "payment:refund" }
  );
}
