import { NextResponse } from "next/server";
import { getTurnoActivo } from "@/lib/caja";
import { authorizeCash, cajaErrorResponse } from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authorizeCash(request, CASH_PATHS.turno, "LISTAR");
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await getTurnoActivo());
  } catch (error) {
    return cajaErrorResponse(error);
  }
}
