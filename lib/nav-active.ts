/**
 * Determina si un enlace del menú está activo.
 * `exact` se usa en submenús para que `/caja` no marque también
 * `/caja/movimientos` ni `/caja/historial`.
 */
export function isNavActive(
  pathname: string,
  url?: string | null,
  exact = false
): boolean {
  if (!url || url === "#") return false;
  if (url === "/") return pathname === "/";
  if (exact) return pathname === url;
  return pathname === url || pathname.startsWith(url.endsWith("/") ? url : `${url}/`);
}
