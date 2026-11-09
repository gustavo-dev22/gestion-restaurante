import { getHomePath, getRoleName, getSections, type AuthUserLike } from "@/lib/roles";

export const RESTAURANT_SYSTEM_ID = 13;

export interface LocalSessionData {
  sub: string;
  nombre: string;
  rol: string;
  home: string;
  sections: string[];
  authMethod: "direct" | "sso";
}

/**
 * Extrae y valida el usuario del payload de SASI (login directo o canje SSO).
 * Solo se acepta si tiene acceso activo al Sistema de Restaurante (13).
 */
export function getRestaurantUser(payload: unknown): AuthUserLike | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const usuario = (record.usuario ?? payload) as AuthUserLike | null;
  if (!usuario) return null;

  const tieneAcceso = usuario.sistemas?.some(
    (sistema) => sistema.id === RESTAURANT_SYSTEM_ID && sistema.activo === true
  );

  return tieneAcceso ? usuario : null;
}

/**
 * Construye los datos de la sesión local a partir del usuario SASI.
 * Centraliza la lógica usada por el login directo y por el callback SSO.
 */
export function buildLocalSession(
  usuario: AuthUserLike,
  authMethod: "direct" | "sso" = "direct"
): LocalSessionData | null {
  const sub = String(usuario.id ?? "").trim();
  if (!sub) return null;

  const home = getHomePath(usuario);
  let sections = getSections(usuario);

  // Fallback: deriva la sección desde la vista de inicio si SASI no trae menús.
  if (sections.length === 0) {
    const segment = home.split("/").filter(Boolean)[0];
    if (segment) sections = [segment];
  }

  return {
    sub,
    nombre: usuario.nombreCompleto ?? "Usuario",
    rol: getRoleName(usuario),
    home,
    sections,
    authMethod,
  };
}
