import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeLocal } from "@/lib/rbac";
import { actorFromSession, auditLogSafe, getAuditContext } from "@/lib/audit";
import { idSchema } from "@/lib/api-validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeLocal(request, "products:manage");
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const antes = await prisma.categoria.findUnique({ where: { id: parsed.data } });
  if (!antes) {
    return NextResponse.json({ error: "CATEGORIA_NO_ENCONTRADA" }, { status: 404 });
  }

  const categoria = await prisma.categoria.update({
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
      accion: "category.restore",
      entidad: "Categoria",
      entidadId: categoria.id,
      antes,
      despues: categoria,
      motivo: "Restauración de categoría",
    },
    getAuditContext(request)
  );

  return NextResponse.json(categoria);
}
