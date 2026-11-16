import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLog, getAuditContext } from "@/lib/audit";
import {
  authorizeLocal,
  normalizePermissionCodes,
} from "@/lib/rbac";

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "roles:manage");
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as
    | { rolId?: unknown; permisos?: unknown }
    | null;
  const rolId = Number(body?.rolId);
  if (!Number.isInteger(rolId) || rolId <= 0) {
    return NextResponse.json(
      { error: "ROL_INVALIDO", message: "El rol es inválido." },
      { status: 400 }
    );
  }

  const rol = await prisma.rolLocal.findUnique({ where: { id: rolId } });
  if (!rol) {
    return NextResponse.json(
      { error: "ROL_NO_ENCONTRADO", message: "El rol no existe." },
      { status: 404 }
    );
  }

  const codigos = normalizePermissionCodes(body?.permisos);
  if (rol.codigo === "ADMIN" && !codigos.includes("roles:manage")) {
    return NextResponse.json(
      {
        error: "PERMISO_REQUERIDO",
        message: "El rol Administrador debe conservar el permiso roles:manage.",
      },
      { status: 400 }
    );
  }

  const permisos = await prisma.permiso.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true, codigo: true },
  });
  const antes = await prisma.rolPermiso.findMany({
    where: { rolId },
    include: { permiso: { select: { codigo: true } } },
  });
  const antesCodigos = antes.map((item) => item.permiso.codigo).sort();

  await prisma.$transaction(async (tx) => {
    await tx.rolPermiso.deleteMany({ where: { rolId } });
    if (permisos.length > 0) {
      await tx.rolPermiso.createMany({
        data: permisos.map((permiso) => ({ rolId, permisoId: permiso.id })),
      });
    }

    await auditLog(
      {
        actor: actorFromSession(auth),
        accion: "role.permissions.update",
        entidad: "RolLocal",
        entidadId: rolId,
        antes: { codigo: rol.codigo, permisos: antesCodigos },
        despues: {
          codigo: rol.codigo,
          permisos: permisos.map((permiso) => permiso.codigo).sort(),
        },
      },
      getAuditContext(request),
      tx
    );
  });

  return NextResponse.json({
    success: true,
    permisos: permisos.map((permiso) => permiso.codigo).sort(),
  });
}
