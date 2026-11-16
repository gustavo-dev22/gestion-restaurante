import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateIdempotencyKey } from "@/lib/idempotency-key";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const STALE_PROCESSING_MS = 90 * 1000; // reserva "en proceso" demasiado antigua
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_KEY_LENGTH = 100;

let lastCleanup = 0;

type BeginResult =
  | { type: "proceed" }
  | { type: "in_progress" }
  | { type: "conflict" }
  | { type: "completed"; status: number; body: unknown };

export interface IdempotencyOptions {
  required?: boolean;
  scope?: string;
}

function parseResponse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function cleanupExpired(now: Date) {
  if (Date.now() - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = Date.now();
  await prisma.idempotencyKey
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);
}

async function beginIdempotency(
  key: string,
  scope: string,
  requestHash: string
): Promise<BeginResult> {
  const now = new Date();
  await cleanupExpired(now);

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      return { type: "conflict" };
    }
    if (existing.expiresAt <= now) {
      await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => undefined);
    } else if (existing.status === 0) {
      const age = now.getTime() - existing.createdAt.getTime();
      if (age > STALE_PROCESSING_MS) {
        await prisma.idempotencyKey.delete({ where: { id: existing.id } }).catch(() => undefined);
      } else {
        return { type: "in_progress" };
      }
    } else {
      return {
        type: "completed",
        status: existing.status,
        body: parseResponse(existing.response),
      };
    }
  }

  try {
    await prisma.idempotencyKey.create({
      data: {
        id: generateIdempotencyKey(),
        key,
        scope,
        requestHash,
        status: 0,
        response: null,
        expiresAt: new Date(now.getTime() + TTL_MS),
      },
    });
    return { type: "proceed" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const row = await prisma.idempotencyKey.findUnique({ where: { key } });
      if (row && row.requestHash && row.requestHash !== requestHash) {
        return { type: "conflict" };
      }
      if (row && row.status > 0) {
        return { type: "completed", status: row.status, body: parseResponse(row.response) };
      }
      return { type: "in_progress" };
    }
    throw error;
  }
}

async function completeIdempotency(key: string, status: number, body: unknown) {
  await prisma.idempotencyKey
    .updateMany({
      where: { key, status: 0 },
      data: { status, response: JSON.stringify(body ?? null) },
    })
    .catch(() => undefined);
}

async function abortIdempotency(key: string) {
  await prisma.idempotencyKey.deleteMany({ where: { key, status: 0 } }).catch(() => undefined);
}

function isCacheableStatus(status: number) {
  return (
    (status >= 200 && status < 300) ||
    status === 400 ||
    status === 409 ||
    status === 422
  );
}

/**
 * Envuelve un handler de ruta para hacerlo idempotente usando la cabecera
 * `X-Idempotency-Key`. La clave se aísla por scope para evitar colisiones.
 */
export async function withIdempotency(
  request: Request,
  handler: () => Promise<NextResponse>,
  options: IdempotencyOptions = {}
): Promise<NextResponse> {
  const rawKey = request.headers.get("x-idempotency-key")?.trim();
  const { required = false, scope = "global" } = options;

  if (!rawKey) {
    if (required) {
      return NextResponse.json(
        {
          error: "IDEMPOTENCY_KEY_REQUERIDA",
          message: "Debes enviar la cabecera X-Idempotency-Key para esta operación.",
        },
        { status: 400 }
      );
    }
    return handler();
  }

  if (rawKey.length > MAX_KEY_LENGTH) {
    return NextResponse.json(
      { error: "IDEMPOTENCY_KEY_INVALIDA", message: "La clave de idempotencia es demasiado larga." },
      { status: 400 }
    );
  }

  const scopeValue = scope.slice(0, 150);
  const key = hash(`${scopeValue}:${rawKey}`);
  let bodyText = "";
  try {
    bodyText = await request.clone().text();
  } catch {
    bodyText = "";
  }
  const requestHash = hash(
    `${request.method}:${new URL(request.url).pathname}:${bodyText}`
  );
  const state = await beginIdempotency(key, scopeValue, requestHash);

  if (state.type === "conflict") {
    return NextResponse.json(
      {
        error: "IDEMPOTENCY_CONFLICT",
        message: "La clave ya fue usada con un cuerpo de solicitud diferente.",
      },
      { status: 409 }
    );
  }

  if (state.type === "completed") {
    return NextResponse.json(state.body, { status: state.status });
  }

  if (state.type === "in_progress") {
    return NextResponse.json(
      {
        error: "IDEMPOTENCY_IN_PROGRESS",
        message: "La solicitud con esta clave aún se está procesando. Reintenta en unos segundos.",
      },
      { status: 425 }
    );
  }

  try {
    const response = await handler();

    if (!isCacheableStatus(response.status)) {
      await abortIdempotency(key);
      return response;
    }

    const clone = response.clone();
    let body: unknown = null;
    try {
      body = await clone.json();
    } catch {
      body = null;
    }

    await completeIdempotency(key, response.status, body);
    return response;
  } catch (error) {
    await abortIdempotency(key);
    throw error;
  }
}
