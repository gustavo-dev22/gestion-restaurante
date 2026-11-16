import { NextResponse } from "next/server";
import { registrarPago } from "@/lib/payments";
import { getCuentaPedido } from "@/lib/cobros";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { parseJson, paymentSchema } from "@/lib/api-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(
    request,
    async () => {
    const auth = await authorizeLocal(request, "payments:create");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const pedidoId = Number(id);
      const parsed = await parseJson(request, paymentSchema);
      if (!parsed.success) return parsed.response;

      const resultado = await registrarPago({
        actor: auth,
        pedidoId,
        metodo: parsed.data.metodoPago,
        monto: parsed.data.monto,
        propina: parsed.data.propina ?? 0,
        referencia: parsed.data.referencia ?? null,
        codigoAutorizacion: parsed.data.codigoAutorizacion ?? null,
        terminal: parsed.data.terminal ?? null,
        montoRecibido: parsed.data.montoRecibido ?? null,
        etiqueta: parsed.data.etiqueta ?? null,
        aplicaciones: parsed.data.aplicaciones,
        allowAnyOrder: true,
        audit: getAuditContext(request),
      });

      revalidateCaja();
      return NextResponse.json({
        success: true,
        message:
          resultado.saldo <= 0
            ? "Pago procesado y mesa liberada"
            : "Pago parcial registrado",
        ...resultado,
        cuenta: await getCuentaPedido(pedidoId),
      });
    } catch (error) {
      return cajaErrorResponse(error);
    }
    },
    { required: true, scope: "payment:create" }
  );
}
