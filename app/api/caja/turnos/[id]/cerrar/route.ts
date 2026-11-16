import { NextResponse } from "next/server";
import { cerrarTurno } from "@/lib/caja";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withIdempotency(request, async () => {
    const auth = await authorizeLocal(request, "caja:close");
    if (auth instanceof NextResponse) return auth;

    try {
      const { id } = await params;
      const turnoId = Number(id);
      const body = (await request.json().catch(() => null)) as
        | { efectivoContado?: unknown; justificacion?: unknown }
        | null;

      const turno = await cerrarTurno(
        auth,
        turnoId,
        body?.efectivoContado,
        body?.justificacion,
        getAuditContext(request)
      );
      revalidateCaja();
      return NextResponse.json({ success: true, turno });
    } catch (error) {
      return cajaErrorResponse(error);
    }
  });
}
