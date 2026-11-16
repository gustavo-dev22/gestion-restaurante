import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { idSchema } from "@/lib/api-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeLocal(request, "tables:manage");
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const antes = await prisma.mesa.findUnique({ where: { id: parsed.data } });
  if (!antes) {
    return NextResponse.json({ error: "MESA_NO_ENCONTRADA" }, { status: 404 });
  }

  const mesa = await prisma.mesa.update({
    where: { id: parsed.data },
    data: {
      activo: true,
      eliminadoEn: null,
      eliminadoPorId: null,
      eliminadoPorNombre: null,
      motivoEliminacion: null,
    },
  });

  await auditLogSafe(
    {
      actor: actorFromSession(auth),
      accion: "table.restore",
      entidad: "Mesa",
      entidadId: mesa.id,
      antes,
      despues: mesa,
      motivo: "Restauración de mesa",
    },
    getAuditContext(request)
  );

  return NextResponse.json(mesa);
}
