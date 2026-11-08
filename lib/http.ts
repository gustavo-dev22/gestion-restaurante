import { useAuthStore } from "@/lib/store";
import { logger } from "@/lib/logger";
import { generateIdempotencyKey } from "@/lib/idempotency-key";

export class HttpError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status = 0, data?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.data = data;
  }
}

export interface HttpOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  timeoutMs?: number;
  skipAuthRedirect?: boolean;
  /** Clave de idempotencia; en POST se genera una automáticamente. */
  idempotencyKey?: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const NETWORK_MESSAGE = "No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.";
const TIMEOUT_MESSAGE = "La solicitud tardó demasiado. Verifica tu conexión e inténtalo de nuevo.";

let redirectingToLogin = false;

function handleUnauthorized() {
  if (typeof window === "undefined" || redirectingToLogin) return;
  redirectingToLogin = true;

  try {
    useAuthStore.getState().logout();
  } catch {
    // Si el store no está disponible, continuamos con la redirección.
  }

  // Limpia también la cookie de sesión en el servidor.
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {
    // Fire-and-forget: la redirección continúa aunque falle.
  });

  const current = `${window.location.pathname}${window.location.search}`;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign(`/login?redirect=${encodeURIComponent(current)}`);
  }
}

function extractMessage(data: unknown, status: number) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const message = record.message ?? record.error;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (status === 404) return "El recurso solicitado no existe.";
  if (status >= 500) return "El servidor presentó un error. Inténtalo más tarde.";
  return `No se pudo completar la solicitud (${status}).`;
}

export async function request<T>(input: string | URL, options: HttpOptions = {}): Promise<T> {
  const {
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipAuthRedirect,
    idempotencyKey,
    headers,
    ...rest
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const method = String(rest.method ?? "GET").toUpperCase();
  const finalIdempotencyKey =
    idempotencyKey ?? (method === "POST" ? generateIdempotencyKey() : undefined);
  const finalHeaders: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(finalIdempotencyKey ? { "X-Idempotency-Key": finalIdempotencyKey } : {}),
    ...(headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(input, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      signal: rest.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      logger.error("Timeout de solicitud HTTP", { url: String(input) });
      throw new HttpError(TIMEOUT_MESSAGE, 0);
    }
    logger.error("Error de red HTTP", { url: String(input), error });
    throw new HttpError(NETWORK_MESSAGE, 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    if (!skipAuthRedirect) handleUnauthorized();
    throw new HttpError("Tu sesión expiró. Inicia sesión nuevamente.", 401);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let data: unknown = null;

  if (contentType.includes("application/json")) {
    data = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    data = text || null;
  }

  if (!response.ok) {
    if (response.status >= 500) {
      logger.error("Error del servidor HTTP", { url: String(input), status: response.status });
    }
    throw new HttpError(extractMessage(data, response.status), response.status, data);
  }

  return data as T;
}

export const http = {
  get: <T>(url: string | URL, options?: HttpOptions) => request<T>(url, { ...options, method: "GET" }),
  post: <T>(url: string | URL, body?: unknown, options?: HttpOptions) =>
    request<T>(url, { ...options, method: "POST", body }),
  patch: <T>(url: string | URL, body?: unknown, options?: HttpOptions) =>
    request<T>(url, { ...options, method: "PATCH", body }),
  put: <T>(url: string | URL, body?: unknown, options?: HttpOptions) =>
    request<T>(url, { ...options, method: "PUT", body }),
  delete: <T>(url: string | URL, options?: HttpOptions) =>
    request<T>(url, { ...options, method: "DELETE" }),
};

export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
