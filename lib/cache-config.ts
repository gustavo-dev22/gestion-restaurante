/**
 * Configuración centralizada de caché de datos del servidor.
 *
 * Preparado para migrar a `use cache` + `cacheLife()`/`cacheTag()` cuando
 * Next.js estabilice esas directivas: las funciones de `lib/reports.ts` ya
 * son puras y sin contexto de request, por lo que solo habría que añadir las
 * directivas allí y reemplazar los wrappers `unstable_cache`.
 */
export const CACHE_TAGS = {
  reports: "reportes",
  dashboard: "dashboard",
} as const;

export const CACHE_REVALIDATE_SECONDS = 30;
