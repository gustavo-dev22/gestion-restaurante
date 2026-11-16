import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth/session";
import {
  hasAnyCashPermission,
  hasCashPermission,
  type CashAction,
} from "@/lib/auth/cash-permissions";
import { CajaError } from "@/lib/caja-errors";
import { CACHE_TAGS } from "@/lib/cache-config";
import { logger } from "@/lib/logger";

export async function authorizeCash(
  request: Request,
  url: string,
  action: CashAction
): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
      { status: 401 }
    );
  }

  if (!hasCashPermission(session, url, action)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "No tienes permiso para realizar esta acción de caja.",
      },
      { status: 403 }
    );
  }

  return session;
}

export async function authorizeCashAny(
  request: Request,
  urls: readonly string[],
  action: CashAction
): Promise<SessionPayload | NextResponse> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Debes iniciar sesión." },
      { status: 401 }
    );
  }

  if (!hasAnyCashPermission(session, urls, action)) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "No tienes permiso para realizar esta acción de caja.",
      },
      { status: 403 }
    );
  }

  return session;
}

export function cajaErrorResponse(error: unknown): NextResponse {
  if (error instanceof CajaError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.message,
        ...(error.extra ?? {}),
      },
      { status: error.status }
    );
  }

  logger.error("Error de caja", { error });
  return NextResponse.json(
    { error: "CAJA_ERROR", message: "No se pudo completar la operación de caja." },
    { status: 500 }
  );
}

export function revalidateCaja() {
  revalidateTag(CACHE_TAGS.caja, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  revalidateTag(CACHE_TAGS.reports, "max");
}
