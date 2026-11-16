import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { registrarPago } from "@/lib/payments";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { withIdempotency } from "@/lib/idempotency";

export async function PATCH(request: Request) {
  return withIdempotency(request, async () => {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
        { status: 401 }
      );
    }

    try {
      const body = (await request.json().catch(() => null)) as
        | { pedidoId?: unknown; metodoPago?: unknown }
        | null;

      const resultado = await registrarPago({
        actor: session,
        pedidoId: Number(body?.pedidoId),
        metodo: String(body?.metodoPago ?? ""),
        allowAnyOrder: false,
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
