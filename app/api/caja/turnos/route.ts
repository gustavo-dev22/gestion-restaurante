import { NextResponse } from "next/server";
import { abrirTurno, getHistorialTurnos } from "@/lib/caja";
import {
  authorizeCash,
  cajaErrorResponse,
  revalidateCaja,
} from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";
import { withIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCash(request, CASH_PATHS.historial, "LISTAR");
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    return NextResponse.json(await getHistorialTurnos(Number.isFinite(page) ? page : 1));
  } catch (error) {
    return cajaErrorResponse(error);
  }
}

export async function POST(request: Request) {
  return withIdempotency(request, async () => {
    const auth = await authorizeCash(request, CASH_PATHS.turno, "CREAR");
    if (auth instanceof NextResponse) return auth;

    try {
      const body = (await request.json().catch(() => null)) as
        | { fondoInicial?: unknown }
        | null;
      const turno = await abrirTurno(auth, Number(body?.fondoInicial));
      revalidateCaja();
      return NextResponse.json({ success: true, turno });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
