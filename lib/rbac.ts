import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  isPermissionCode,
  mapSasiRoleToLocal,
  type PermissionCode,
} from "@/lib/rbac-constants";

let seedPromise: Promise<void> | null = null;

async function seedRbac(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const permiso of PERMISSIONS) {
      await tx.permiso.upsert({
        where: { codigo: permiso.codigo },
        update: {
          nombre: permiso.nombre,
          descripcion: permiso.descripcion,
          grupo: permiso.grupo,
        },
        create: {
          codigo: permiso.codigo,
          nombre: permiso.nombre,
          descripcion: permiso.descripcion,
          grupo: permiso.grupo,
        },
      });
    }

    for (const definicion of ROLE_DEFINITIONS) {
      const existente = await tx.rolLocal.findUnique({
        where: { codigo: definicion.codigo },
        select: { id: true },
      });

      const rol = await tx.rolLocal.upsert({
        where: { codigo: definicion.codigo },
        update: {
          nombre: definicion.nombre,
          descripcion: definicion.descripcion,
        },
        create: {
          codigo: definicion.codigo,
          nombre: definicion.nombre,
          descripcion: definicion.descripcion,
          esSistema: true,
        },
      });

      // No pisa permisos personalizados: solo asigna los defaults al crear el rol.
      if (existente) continue;

      const permisos = await tx.permiso.findMany({
        where: { codigo: { in: definicion.permisos } },
        select: { id: true },
      });

      for (const permiso of permisos) {
        await tx.rolPermiso.create({
          data: { rolId: rol.id, permisoId: permiso.id },
        });
      }
    }
  });
}

export async function ensureRbacSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedRbac().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

interface LocalUserInput {
  sub: string;
  nombre: string;
  rolSasi: string;
  email?: string | null;
}

const userInclude = {
  roles: { include: { rol: true } },
  permisos: { include: { permiso: true } },
} as const;

type LocalUserWithRelations = Prisma.UsuarioAppGetPayload<{
  include: typeof userInclude;
}>;

async function createLocalUser(
  input: LocalUserInput,
  roleCode: string | null
): Promise<LocalUserWithRelations> {
  const role = roleCode
    ? await prisma.rolLocal.findUnique({ where: { codigo: roleCode }, select: { id: true } })
    : null;

  return prisma.usuarioApp.create({
    data: {
      sasiSub: input.sub.slice(0, 100),
      nombre: input.nombre.slice(0, 150) || "Usuario",
      email: input.email?.slice(0, 200) ?? null,
      rolSasi: input.rolSasi.slice(0, 100) || null,
      ultimoAccesoEn: new Date(),
      ...(role
        ? {
            roles: {
              create: [{ rolId: role.id }],
            },
          }
        : {}),
    },
    include: userInclude,
  });
}

export async function ensureLocalUserFromSasi(input: LocalUserInput): Promise<void> {
  await ensureRbacSeed();

  const existente = await prisma.usuarioApp.findUnique({
    where: { sasiSub: input.sub },
    select: { id: true },
  });

  if (existente) {
    await prisma.usuarioApp.update({
      where: { id: existente.id },
      data: {
        nombre: input.nombre.slice(0, 150) || "Usuario",
        email: input.email?.slice(0, 200) ?? null,
        rolSasi: input.rolSasi.slice(0, 100) || null,
        ultimoAccesoEn: new Date(),
      },
    });
    return;
  }

  try {
    await createLocalUser(input, mapSasiRoleToLocal(input.rolSasi));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
}

async function getLocalUser(session: SessionPayload): Promise<LocalUserWithRelations | null> {
  await ensureRbacSeed();

  const existente = await prisma.usuarioApp.findUnique({
    where: { sasiSub: session.sub },
    include: userInclude,
  });

  if (existente) return existente.activo ? existente : null;

  try {
    const creado = await createLocalUser(
      {
        sub: session.sub,
        nombre: session.nombre,
        rolSasi: session.rol,
      },
      mapSasiRoleToLocal(session.rol)
    );
    return creado.activo ? creado : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const otro = await prisma.usuarioApp.findUnique({
        where: { sasiSub: session.sub },
        include: userInclude,
      });
      return otro?.activo ? otro : null;
    }
    throw error;
  }
}

export interface LocalUserContext {
  user: LocalUserWithRelations;
  permissions: Set<string>;
}

export async function getLocalUserContext(
  session: SessionPayload
): Promise<LocalUserContext | null> {
  const user = await getLocalUser(session);
  if (!user) return null;

  const roleIds = user.roles.map((item) => item.rolId);
  const [rolePermissions, overrides] = await Promise.all([
    roleIds.length
      ? prisma.rolPermiso.findMany({
          where: { rolId: { in: roleIds } },
          include: { permiso: true },
        })
      : Promise.resolve([]),
    prisma.usuarioPermiso.findMany({
      where: { usuarioId: user.id },
      include: { permiso: true },
    }),
  ]);

  const permissions = new Set<string>();
  for (const item of rolePermissions) {
    permissions.add(item.permiso.codigo);
  }
  for (const item of overrides) {
    if (item.permitido) {
      permissions.add(item.permiso.codigo);
    } else {
      permissions.delete(item.permiso.codigo);
    }
  }

  return { user, permissions };
}

export async function hasLocalPermission(
  session: SessionPayload | null | undefined,
  codigo: PermissionCode | string
): Promise<boolean> {
  if (!session) return false;
  try {
    const context = await getLocalUserContext(session);
    return context?.permissions.has(codigo) ?? false;
  } catch (error) {
    logger.error("No se pudieron resolver los permisos locales", { error });
    return false;
  }
}

export async function authorizeLocal(
  request: Request,
  codigo: PermissionCode | string
): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
      { status: 401 }
    );
  }

  const context = await getLocalUserContext(session);
  if (!context) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Tu usuario local está deshabilitado." },
      { status: 403 }
    );
  }

  if (!context.permissions.has(codigo)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: `No tienes el permiso local "${codigo}" para realizar esta acción.`,
      },
      { status: 403 }
    );
  }

  return session;
}

export function normalizePermissionCodes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .filter((value) => isPermissionCode(value))
    )
  );
}
