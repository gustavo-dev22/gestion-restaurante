import { NextResponse } from "next/server";
import { registrarPago } from "@/lib/payments";
import {
  authorizeCash,
  cajaErrorResponse,
  revalidateCaja,
} from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    const auth = await authorizeCash(request, CASH_PATHS.turno, "CREAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const body = (await request.json().catch(() => null)) as
        | { pedidoId?: unknown; metodoPago?: unknown; referencia?: unknown }
        | null;

      const resultado = await registrarPago({
        actor: auth,
        pedidoId: Number(body?.pedidoId),
        metodo: String(body?.metodoPago ?? ""),
        referencia: body?.referencia == null ? null : String(body.referencia),
        allowAnyOrder: true,
      });

      revalidateCaja();
      return NextResponse.json({
        success: true,
        message: "Pago procesado y mesa liberada",
        ...resultado,
        metodoPago: resultado.metodo,
      });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
