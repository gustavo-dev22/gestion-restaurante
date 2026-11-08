import { HttpError } from "@/lib/http";
import { generateIdempotencyKey } from "@/lib/idempotency-key";

const STORAGE_KEY = "gr-offline-queue";
const MAX_ITEMS = 50;

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  label?: string;
  idempotencyKey: string;
  createdAt: number;
}

function readQueue(): QueuedRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // Almacenamiento no disponible (modo privado/cuota): se ignora.
  }
}

export function getQueue(): QueuedRequest[] {
  return readQueue();
}

export function enqueueRequest(
  request: Omit<QueuedRequest, "id" | "createdAt" | "idempotencyKey"> & {
    idempotencyKey?: string;
  }
): QueuedRequest {
  const item: QueuedRequest = {
    ...request,
    idempotencyKey: request.idempotencyKey || generateIdempotencyKey(),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  writeQueue([...readQueue(), item]);
  return item;
}

export function removeQueuedRequest(id: string) {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return error instanceof HttpError && error.status === 0;
}

let flushing = false;

export async function flushOfflineQueue(): Promise<{
  sent: number;
  failed: number;
  errors: string[];
}> {
  if (flushing) return { sent: 0, failed: 0, errors: [] };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { sent: 0, failed: readQueue().length, errors: [] };
  }

  flushing = true;
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    for (const item of readQueue()) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": item.idempotencyKey || generateIdempotencyKey(),
          },
          body: item.body === undefined ? undefined : JSON.stringify(item.body),
        });

        if (response.ok) {
          sent += 1;
          removeQueuedRequest(item.id);
          continue;
        }

        // Errores transitorios o de sesión: se conserva para reintentar luego.
        if (response.status === 401 || response.status === 403) {
          failed += 1;
          errors.push("Tu sesión expiró. Inicia sesión para enviar las comandas pendientes.");
          continue;
        }
        if (response.status === 425 || response.status === 429 || response.status >= 500) {
          failed += 1;
          errors.push("El servidor no está disponible. Se reintentará al reconectar.");
          continue;
        }

        // Error de negocio (ej. stock insuficiente): se descarta y se informa.
        let message = `Error ${response.status}`;
        try {
          const data = (await response.json()) as { message?: string; error?: string };
          message = data.message || data.error || message;
        } catch {
          // Sin cuerpo JSON.
        }
        failed += 1;
        errors.push(message);
        removeQueuedRequest(item.id);
      } catch {
        // Error de red: se conserva en cola para el próximo intento.
        failed += 1;
        errors.push("Sin conexión");
      }
    }
  } finally {
    flushing = false;
  }

  return { sent, failed, errors };
}
