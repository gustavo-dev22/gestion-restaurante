import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorFromSession, auditLog, getAuditContext } from "@/lib/audit";
import { authorizeLocal } from "@/lib/rbac";
import { userRolesSchema } from "@/lib/api-validation";

function parseRoleIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
}

export async function PATCH(request: Request) {
  const auth = await authorizeLocal(request, "roles:manage");
  if (auth instanceof NextResponse) return auth;

  const parsed = userRolesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDACION", message: "Datos inválidos" },
      { status: 400 }
    );
  }
  const usuarioId = parsed.data.usuarioId;
  const rolIds = parseRoleIds(parsed.data.rolIds);

  const [usuario, roles, antes] = await Promise.all([
    prisma.usuarioApp.findUnique({ where: { id: usuarioId } }),
    prisma.rolLocal.findMany({
      where: { id: { in: rolIds } },
      select: { id: true, codigo: true },
    }),
    prisma.usuarioRol.findMany({
      where: { usuarioId },
      include: { rol: { select: { codigo: true } } },
    }),
  ]);

  if (!usuario) {
    return NextResponse.json(
      { error: "USUARIO_NO_ENCONTRADO", message: "El usuario no existe." },
      { status: 404 }
    );
  }
  if (roles.length !== rolIds.length) {
    return NextResponse.json(
      { error: "ROL_INVALIDO", message: "Uno o más roles no existen." },
      { status: 400 }
    );
  }

  const antesCodigos = antes.map((item) => item.rol.codigo).sort();

  await prisma.$transaction(async (tx) => {
    await tx.usuarioRol.deleteMany({ where: { usuarioId } });
    if (roles.length > 0) {
      await tx.usuarioRol.createMany({
        data: roles.map((rol) => ({ usuarioId, rolId: rol.id })),
      });
    }

    await auditLog(
      {
        actor: actorFromSession(auth),
        accion: "user.roles.update",
        entidad: "UsuarioApp",
        entidadId: usuarioId,
        antes: { nombre: usuario.nombre, roles: antesCodigos },
        despues: {
          nombre: usuario.nombre,
          roles: roles.map((rol) => rol.codigo).sort(),
        },
      },
      getAuditContext(request),
      tx
    );
  });

  return NextResponse.json({
    success: true,
    roles: roles.map((rol) => ({
      id: rol.id,
      codigo: rol.codigo,
    })),
  });
}
