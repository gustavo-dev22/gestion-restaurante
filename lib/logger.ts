export type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY = /password|token|secret|authorization|cookie|contrase/i;
const MAX_DEPTH = 4;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[object]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(item, depth + 1);
  }
  return output;
}

export function log(level: LogLevel, message: string, context?: unknown) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context === undefined ? {} : { context: sanitize(context) }),
  };

  const line = JSON.stringify(payload);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, context?: unknown) => log("info", message, context),
  warn: (message: string, context?: unknown) => log("warn", message, context),
  error: (message: string, context?: unknown) => log("error", message, context),
};

/**
 * Reporta un error del cliente al servidor sin bloquear la UI ni exponer datos
 * sensibles. Si falla el envío, se registra solo en consola.
 */
export function reportClientError(error: unknown, context: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(`[client] ${message}`, { ...context, error });

  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (typeof navigator.sendBeacon !== "function") return;

  try {
    const payload = JSON.stringify({
      message,
      context: sanitize({ ...context, error }),
    });
    navigator.sendBeacon("/api/log", new Blob([payload], { type: "application/json" }));
  } catch {
    // Nunca interrumpir la UI por el reporte de errores.
  }
}
