import type { SasiMenuObject, SasiSistema } from "@/lib/types";

export interface AuthUserLike {
  id?: unknown;
  nombreCompleto?: string;
  sistemas?: SasiSistema[];
}

const PUBLIC_PATHS = ["/", "/login", "/reservar", "/cliente"];

const PREFERRED_HOME = [
  "/admin/dashboard",
  "/admin/productos",
  "/mesero/salon",
  "/mesero/mis-pedidos",
  "/cocina/comandas",
  "/cocina/stock",
  "/dashboard",
];

export function getSasiSistema(user: AuthUserLike | null | undefined): SasiSistema | undefined {
  return user?.sistemas?.find((sistema) => sistema.id === 13) ?? user?.sistemas?.[0];
}

export function getActiveRole(user: AuthUserLike | null | undefined) {
  const sistema = getSasiSistema(user);
  return sistema?.roles?.find((rol) => rol.esPrincipal) ?? sistema?.roles?.[0];
}

export function getRoleName(user: AuthUserLike | null | undefined): string {
  return getActiveRole(user)?.nombreRol ?? "Usuario";
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function normalizePath(url?: string | null): string | null {
  if (!url || url === "#") return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const { pathname } = new URL(url);
      return pathname.startsWith("/") ? pathname : `/${pathname}`;
    } catch {
      return null;
    }
  }

  return url.startsWith("/") ? url : `/${url}`;
}

export function getAllowedPaths(user: AuthUserLike | null | undefined): Set<string> {
  const role = getActiveRole(user);
  const paths = new Set<string>();

  const collect = (objetos?: SasiMenuObject[]) => {
    objetos?.forEach((objeto) => {
      const normalized = normalizePath(objeto.url);
      if (normalized) paths.add(normalized);
    });
  };

  collect(role?.objetos);

  if (paths.size === 0) {
    user?.sistemas?.forEach((sistema) => {
      sistema.roles?.forEach((rol) => collect(rol.objetos));
    });
  }

  return paths;
}

function sectionOf(pathname: string) {
  const [, section] = pathname.split("/");
  return section ? `/${section}` : "/";
}

export function isPathAllowed(user: AuthUserLike | null | undefined, pathname: string): boolean {
  if (isPublicPath(pathname)) return true;

  const allowed = getAllowedPaths(user);
  // Sin menús definidos en SASI: no bloqueamos para no dejar al usuario fuera.
  if (allowed.size === 0) return true;

  if (pathname === "/dashboard") return true;

  for (const path of allowed) {
    if (pathname === path || pathname.startsWith(`${path}/`) || path.startsWith(`${pathname}/`)) {
      return true;
    }
  }

  const section = sectionOf(pathname);
  return Array.from(allowed).some((path) => path === section || path.startsWith(`${section}/`));
}

export function getHomePath(user: AuthUserLike | null | undefined): string {
  const allowed = getAllowedPaths(user);

  if (allowed.size > 0) {
    const preferred = PREFERRED_HOME.find((path) => allowed.has(path));
    if (preferred) return preferred;

    const firstMenu = Array.from(allowed).find((path) => !path.startsWith("/api"));
    if (firstMenu) return firstMenu;
  }

  const role = getRoleName(user).toLowerCase();
  if (/(admin|administrador|gerente|dueño|dueno)/.test(role)) return "/admin/dashboard";
  if (/(mesero|waiter|salón|salon|atención|atencion)/.test(role)) return "/mesero/salon";
  if (/(cocina|chef|cocinero|bar|bebidas|postres)/.test(role)) return "/cocina/comandas";

  return "/dashboard";
}
