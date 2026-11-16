import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import RolesClient from "@/components/admin/RolesClient";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth/server-session";
import {
  ensureRbacSeed,
  getLocalUserContext,
} from "@/lib/rbac";
import type { RbacDataDto } from "@/lib/rbac-types";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const context = await getLocalUserContext(session);
  if (!context?.permissions.has("roles:manage")) {
    redirect("/admin/dashboard");
  }

  await ensureRbacSeed();

  const [roles, permisos, usuarios] = await Promise.all([
    prisma.rolLocal.findMany({
      orderBy: { id: "asc" },
      include: {
        permisos: {
          include: { permiso: { select: { codigo: true } } },
        },
      },
    }),
    prisma.permiso.findMany({
      orderBy: [{ grupo: "asc" }, { nombre: "asc" }],
    }),
    prisma.usuarioApp.findMany({
      orderBy: { nombre: "asc" },
      include: {
        roles: {
          include: { rol: { select: { id: true, codigo: true, nombre: true } } },
        },
      },
    }),
  ]);

  const data: RbacDataDto = {
    roles: roles.map((rol) => ({
      id: rol.id,
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      esSistema: rol.esSistema,
      permisos: rol.permisos.map((item) => item.permiso.codigo).sort(),
    })),
    permisos: permisos.map((permiso) => ({
      id: permiso.id,
      codigo: permiso.codigo,
      nombre: permiso.nombre,
      descripcion: permiso.descripcion,
      grupo: permiso.grupo,
    })),
    usuarios: usuarios.map((usuario) => ({
      id: usuario.id,
      sasiSub: usuario.sasiSub,
      nombre: usuario.nombre,
      email: usuario.email,
      rolSasi: usuario.rolSasi,
      activo: usuario.activo,
      roles: usuario.roles.map((item) => ({
        id: item.rol.id,
        codigo: item.rol.codigo,
        nombre: item.rol.nombre,
      })),
    })),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Roles y permisos"
        description="Administra los permisos locales de la app sin esperar la expiración de la sesión."
      />
      <RolesClient initialData={data} />
    </div>
  );
}
