"use client";

import { useMemo, useState } from "react";
import { Save, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { PERMISSION_GROUPS } from "@/lib/rbac-constants";
import type { RbacDataDto, RbacRoleDto, RbacUserDto } from "@/lib/rbac-types";
import { getErrorMessage, http } from "@/lib/http";

interface RolesClientProps {
  initialData: RbacDataDto;
}

export default function RolesClient({ initialData }: RolesClientProps) {
  const [roles, setRoles] = useState<RbacRoleDto[]>(initialData.roles);
  const [users, setUsers] = useState<RbacUserDto[]>(initialData.usuarios);
  const [savingRole, setSavingRole] = useState<number | null>(null);
  const [savingUser, setSavingUser] = useState<number | null>(null);

  const permisosPorGrupo = useMemo(() => {
    return PERMISSION_GROUPS.map((grupo) => ({
      grupo,
      permisos: initialData.permisos.filter((permiso) => permiso.grupo === grupo),
    })).filter((item) => item.permisos.length > 0);
  }, [initialData.permisos]);

  const roleById = useMemo(
    () => new Map(roles.map((rol) => [rol.id, rol])),
    [roles]
  );

  const togglePermission = (rolId: number, codigo: string) => {
    setRoles((prev) =>
      prev.map((rol) => {
        if (rol.id !== rolId) return rol;
        if (rol.codigo === "ADMIN" && codigo === "roles:manage") return rol;
        const activo = rol.permisos.includes(codigo);
        return {
          ...rol,
          permisos: activo
            ? rol.permisos.filter((item) => item !== codigo)
            : [...rol.permisos, codigo],
        };
      })
    );
  };

  const saveRole = async (rol: RbacRoleDto) => {
    setSavingRole(rol.id);
    try {
      const data = await http.patch<{ success: boolean; permisos: string[] }>(
        "/api/admin/roles/permisos",
        { rolId: rol.id, permisos: rol.permisos }
      );
      setRoles((prev) =>
        prev.map((item) =>
          item.id === rol.id ? { ...item, permisos: data.permisos } : item
        )
      );
      toastSuccess("Permisos guardados", `Se actualizó el rol ${rol.nombre}.`);
    } catch (error) {
      toastError("No se pudieron guardar los permisos", getErrorMessage(error));
    } finally {
      setSavingRole(null);
    }
  };

  const toggleUserRole = (usuarioId: number, rolId: number) => {
    setUsers((prev) =>
      prev.map((usuario) => {
        if (usuario.id !== usuarioId) return usuario;
        const existe = usuario.roles.some((rol) => rol.id === rolId);
        if (existe) {
          return {
            ...usuario,
            roles: usuario.roles.filter((rol) => rol.id !== rolId),
          };
        }
        const rol = roleById.get(rolId);
        if (!rol) return usuario;
        return {
          ...usuario,
          roles: [
            ...usuario.roles,
            { id: rol.id, codigo: rol.codigo, nombre: rol.nombre },
          ],
        };
      })
    );
  };

  const saveUser = async (usuario: RbacUserDto) => {
    setSavingUser(usuario.id);
    try {
      const data = await http.patch<{
        success: boolean;
        roles: Array<{ id: number; codigo: string }>;
      }>("/api/admin/roles/usuarios", {
        usuarioId: usuario.id,
        rolIds: usuario.roles.map((rol) => rol.id),
      });

      const rolesActualizados = data.roles
        .map((item) => {
          const rol = roleById.get(item.id);
          return rol
            ? { id: rol.id, codigo: rol.codigo, nombre: rol.nombre }
            : null;
        })
        .filter((item): item is { id: number; codigo: string; nombre: string } =>
          Boolean(item)
        );

      setUsers((prev) =>
        prev.map((item) =>
          item.id === usuario.id ? { ...item, roles: rolesActualizados } : item
        )
      );
      toastSuccess("Roles actualizados", `Se actualizaron los roles de ${usuario.nombre}.`);
    } catch (error) {
      toastError("No se pudieron guardar los roles", getErrorMessage(error));
    } finally {
      setSavingUser(null);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Permisos por rol local</h2>
              <p className="text-sm text-slate-600">
                Estos permisos se aplican en la app y no dependen del menú de SASI.
              </p>
            </div>
          </div>
          <Badge tone="blue">Administrador</Badge>
        </CardHeader>
        <CardBody className="space-y-6">
          {roles.map((rol) => (
            <section
              key={rol.id}
              aria-labelledby={`rol-${rol.id}`}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 id={`rol-${rol.id}`} className="font-bold text-slate-800">
                      {rol.nombre}
                    </h3>
                    <Badge tone={rol.codigo === "ADMIN" ? "purple" : "neutral"}>
                      {rol.codigo}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{rol.descripcion}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveRole(rol)}
                  loading={savingRole === rol.id}
                >
                  <Save size={16} aria-hidden="true" />
                  Guardar
                </Button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                {permisosPorGrupo.map(({ grupo, permisos }) => (
                  <fieldset key={grupo} className="rounded-lg bg-slate-50 p-3">
                    <legend className="px-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      {grupo}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {permisos.map((permiso) => {
                        const obligatorio =
                          rol.codigo === "ADMIN" && permiso.codigo === "roles:manage";
                        const checked = rol.permisos.includes(permiso.codigo);
                        return (
                          <label
                            key={permiso.codigo}
                            className="flex items-start gap-2 text-sm text-slate-700"
                            title={permiso.descripcion ?? permiso.codigo}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 rounded border-slate-300 text-blue-600"
                              checked={checked || obligatorio}
                              disabled={obligatorio}
                              onChange={() => togglePermission(rol.id, permiso.codigo)}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{permiso.nombre}</span>
                              <span className="ml-1 text-xs text-slate-500">
                                {permiso.codigo}
                              </span>
                              {obligatorio && (
                                <span className="ml-1 text-xs font-semibold text-blue-700">
                                  obligatorio
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </section>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <Users size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Roles de usuarios locales</h2>
            <p className="text-sm text-slate-600">
              Los usuarios aparecen aquí después de su primer inicio de sesión con SASI.
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="Sin usuarios locales"
                description="Inicia sesión con un usuario de SASI para que se registre en la app."
              />
            </div>
          ) : (
            <DataTable label="Roles de usuarios locales" minWidthClass="min-w-[760px]">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                    Rol SASI
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">
                    Roles locales
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-600">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((usuario) => (
                  <tr key={usuario.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-800">{usuario.nombre}</p>
                      <p className="text-xs text-slate-500">{usuario.sasiSub}</p>
                      {!usuario.activo && (
                        <Badge tone="rose" className="mt-1">
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {usuario.rolSasi ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {roles.map((rol) => {
                          const checked = usuario.roles.some((item) => item.id === rol.id);
                          return (
                            <label
                              key={rol.id}
                              className="flex items-center gap-2 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                className="size-4 rounded border-slate-300 text-blue-600"
                                checked={checked}
                                onChange={() => toggleUserRole(usuario.id, rol.id)}
                              />
                              {rol.nombre}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void saveUser(usuario)}
                        loading={savingUser === usuario.id}
                      >
                        <Save size={16} aria-hidden="true" />
                        Guardar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
