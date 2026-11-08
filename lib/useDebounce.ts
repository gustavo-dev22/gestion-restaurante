"use client";

import { useEffect, useState } from "react";

/**
 * Devuelve el valor recibido después de que deje de cambiar durante `delay` ms.
 * Útil para búsquedas y filtros que no deben recalcularse en cada tecla.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
