import { NextResponse } from "next/server";
import { getReporteTurno } from "@/lib/caja";
import { authorizeCashAny, cajaErrorResponse } from "@/lib/caja-http";
import { CASH_PATHS } from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeCashAny(
    request,
    [CASH_PATHS.turno, CASH_PATHS.historial],
    "EXPORTAR"
  );
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const turnoId = Number(id);
    if (!Number.isInteger(turnoId) || turnoId <= 0) {
      return NextResponse.json(
        { error: "TURNO_INVALIDO", message: "Turno inválido." },
        { status: 400 }
      );
    }

    const reporte = await getReporteTurno(turnoId);
    if (!reporte) {
      return NextResponse.json(
        { error: "TURNO_NO_ENCONTRADO", message: "Turno no encontrado." },
        { status: 404 }
      );
    }
    return NextResponse.json(reporte);
  } catch (error) {
    return cajaErrorResponse(error);
  }
}
