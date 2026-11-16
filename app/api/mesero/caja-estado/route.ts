import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { getCajaEstado } from "@/lib/caja";
import { cajaErrorResponse } from "@/lib/caja-http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
      { status: 401 }
    );
  }

  try {
    return NextResponse.json(await getCajaEstado());
  } catch (error) {
    return cajaErrorResponse(error);
  }
}
