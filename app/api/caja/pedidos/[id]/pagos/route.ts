import { NextResponse } from "next/server";
import { registrarPago } from "@/lib/payments";
import { getCuentaPedido } from "@/lib/cobros";
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
    const auth = await authorizeCash(request, CASH_PATHS.turno, "CREAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const pedidoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | {
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
        pedidoId,
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
  });
}
