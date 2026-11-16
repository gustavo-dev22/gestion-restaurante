import type { AuthUserLike } from "@/lib/roles";

export const CASH_PATHS = {
  turno: "/caja",
  movimientos: "/caja/movimientos",
  historial: "/caja/historial",
} as const;

export type CashAction = "LISTAR" | "CREAR" | "EDITAR" | "EXPORTAR" | "APROBAR";

export type CashPermissions = Record<string, CashAction[]>;

const CASH_ACTIONS: CashAction[] = ["LISTAR", "CREAR", "EDITAR", "EXPORTAR", "APROBAR"];
const CASH_PATH_VALUES = new Set<string>(Object.values(CASH_PATHS));

export function normalizeCashPath(url?: string | null): string | null {
  if (!url) return null;

  let path = url.trim();
  if (path === "#") return null;
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "");
  if (!path) path = "/";

  return CASH_PATH_VALUES.has(path) ? path : null;
}

function isCashAction(value: string): value is CashAction {
  return (CASH_ACTIONS as string[]).includes(value);
}

/**
 * Construye el mapa de acciones de caja a partir del usuario SASI.
 * Une las acciones de todos los roles activos del sistema 13.
 */
export function getCashPermissions(user: AuthUserLike | null | undefined): CashPermissions {
  const sistema = user?.sistemas?.find((item) => item.id === 13);
  if (!sistema) return {};

  const mapa = new Map<string, Set<CashAction>>();

  for (const rol of sistema.roles ?? []) {
    if (rol.activo === false) continue;

    for (const objeto of rol.objetos ?? []) {
      const path = normalizeCashPath(objeto.url);
      if (!path) continue;

      const acciones = mapa.get(path) ?? new Set<CashAction>();
      for (const accion of objeto.acciones ?? []) {
        if (isCashAction(accion)) acciones.add(accion);
      }
      mapa.set(path, acciones);
    }
  }

  const resultado: CashPermissions = {};
  for (const [path, acciones] of mapa) {
    resultado[path] = Array.from(acciones);
  }
  return resultado;
}

export function hasCashPermission(
  session: { cashPermissions?: CashPermissions } | null | undefined,
  url: string,
  action: CashAction
): boolean {
  const path = normalizeCashPath(url);
  if (!path) return false;
  return Boolean(session?.cashPermissions?.[path]?.includes(action));
}

export function hasAnyCashPermission(
  session: { cashPermissions?: CashPermissions } | null | undefined,
  urls: readonly string[],
  action: CashAction
): boolean {
  return urls.some((url) => hasCashPermission(session, url, action));
}
