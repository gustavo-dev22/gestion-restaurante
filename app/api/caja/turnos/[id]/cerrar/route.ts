import { NextResponse } from "next/server";
import { cerrarTurno } from "@/lib/caja";
import { cajaErrorResponse, revalidateCaja } from "@/lib/caja-http";
import { authorizeLocal } from "@/lib/rbac";
import { getAuditContext } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { parseJson, cerrarCajaSchema } from "@/lib/api-validation";

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
      const parsed = await parseJson(request, cerrarCajaSchema);
      if (!parsed.success) return parsed.response;

      const turno = await cerrarTurno(
        auth,
        turnoId,
        parsed.data.efectivoContado,
        parsed.data.justificacion,
        getAuditContext(request)
      );
      revalidateCaja();
      return NextResponse.json({ success: true, turno });
    } catch (error) {
      return cajaErrorResponse(error);
    }
    },
    { scope: "caja:close" }
  );
}
