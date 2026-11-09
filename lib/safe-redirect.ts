/**
 * Devuelve una ruta interna segura o null. Evita redirecciones abiertas:
 * solo acepta rutas relativas que empiezan con "/" y no con "//".
 */
export function getSafeRedirect(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\") || /[\u0000-\u001F]/.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}
