import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { SessionPayload } from "@/lib/auth/session";

export interface AuditContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface AuditActor {
  sub?: string | null;
  nombre?: string | null;
  rol?: string | null;
}

export interface AuditLogInput {
  actor?: AuditActor | null;
  accion: string;
  entidad?: string | null;
  entidadId?: string | number | null;
  antes?: unknown;
  despues?: unknown;
  motivo?: string | null;
  turnoId?: number | null;
}

type AuditDb = Pick<PrismaClient, "auditoria">;

function firstHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function getAuditContext(request: Request): AuditContext {
  const headers = request.headers;
  const requestId =
    headers.get("x-request-id")?.trim() ||
    headers.get("x-correlation-id")?.trim() ||
    crypto.randomUUID();

  return {
    ip:
      firstHeader(headers.get("x-forwarded-for")) ||
      headers.get("x-real-ip")?.trim() ||
      headers.get("cf-connecting-ip")?.trim() ||
      null,
    userAgent: headers.get("user-agent")?.trim().slice(0, 500) || null,
    requestId: requestId.slice(0, 100),
  };
}

export function actorFromSession(
  session: Pick<SessionPayload, "sub" | "nombre" | "rol"> | null | undefined
): AuditActor | null {
  if (!session) return null;
  return {
    sub: session.sub,
    nombre: session.nombre,
    rol: session.rol,
  };
}

function stringifyAuditValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;

  try {
    const serialized = JSON.stringify(value, (_key, item) => {
      if (typeof item === "bigint") return item.toString();
      return item;
    });
    if (serialized === undefined) return null;
    return serialized.length > 1_000_000
      ? `${serialized.slice(0, 1_000_000)}…`
      : serialized;
  } catch {
    return String(value).slice(0, 10_000);
  }
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

export async function auditLog(
  input: AuditLogInput,
  context: AuditContext,
  db: AuditDb = prisma
): Promise<void> {
  await db.auditoria.create({
    data: {
      actorId: truncate(input.actor?.sub, 100),
      actorNombre: truncate(input.actor?.nombre, 150),
      actorRol: truncate(input.actor?.rol, 100),
      ip: truncate(context.ip, 64),
      userAgent: truncate(context.userAgent, 500),
      accion: input.accion.slice(0, 100),
      entidad: truncate(input.entidad, 50),
      entidadId:
        input.entidadId === null || input.entidadId === undefined
          ? null
          : String(input.entidadId).slice(0, 100),
      antes: stringifyAuditValue(input.antes),
      despues: stringifyAuditValue(input.despues),
      motivo: truncate(input.motivo, 500),
      requestId: truncate(context.requestId, 100),
      turnoId:
        typeof input.turnoId === "number" && Number.isInteger(input.turnoId)
          ? input.turnoId
          : null,
    },
  });
}

export async function auditLogSafe(
  input: AuditLogInput,
  context: AuditContext,
  db: AuditDb = prisma
): Promise<void> {
  try {
    await auditLog(input, context, db);
  } catch (error) {
    logger.error("No se pudo registrar la auditoría", {
      accion: input.accion,
      error,
    });
  }
}

