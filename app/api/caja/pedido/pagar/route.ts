import { NextResponse } from "next/server";
import { registrarPago } from "@/lib/payments";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    const auth = await authorizeLocal(request, "payments:create");
    if (auth instanceof NextResponse) return auth;

    try {
      const body = (await request.json().catch(() => null)) as
        | {
            pedidoId?: unknown;
            metodoPago?: unknown;
            monto?: unknown;
            propina?: unknown;
            referencia?: unknown;
            codigoAutorizacion?: unknown;
            terminal?: unknown;
            montoRecibido?: unknown;
            etiqueta?: unknown;
            aplicaciones?: unknown;
          }
        | null;

      const aplicaciones = Array.isArray(body?.aplicaciones)
        ? body.aplicaciones.map((item) => {
            const record = item as Record<string, unknown>;
            return {
              pedidoDetalleId: Number(record.pedidoDetalleId),
              cantidad: Number(record.cantidad),
            };
          })
        : undefined;

      const resultado = await registrarPago({
        actor: auth,
        pedidoId: Number(body?.pedidoId),
        metodo: String(body?.metodoPago ?? ""),
        monto: body?.monto == null ? undefined : Number(body.monto),
        propina: body?.propina == null ? 0 : Number(body.propina),
        referencia: body?.referencia == null ? null : String(body.referencia),
        codigoAutorizacion:
          body?.codigoAutorizacion == null ? null : String(body.codigoAutorizacion),
        terminal: body?.terminal == null ? null : String(body.terminal),
        montoRecibido:
          body?.montoRecibido == null ? null : Number(body.montoRecibido),
        etiqueta: body?.etiqueta == null ? null : String(body.etiqueta),
        aplicaciones,
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
        metodoPago: resultado.metodo,
      });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
