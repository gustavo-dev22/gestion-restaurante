import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(`log:${getClientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    return new NextResponse(null, { status: 429, headers: rateLimitHeaders(limit) });
  }

  try {
    const body = (await request.json()) as { message?: unknown; context?: unknown };
    const message =
      typeof body?.message === "string" ? body.message.slice(0, 300) : "Error de cliente";

    logger.error(`[client-report] ${message}`, {
      ip: getClientIp(request),
      context: body?.context,
    });
  } catch {
    // Un reporte mal formado no debe generar otro error.
  }

  return new NextResponse(null, { status: 204 });
}
