import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isSessionCookieSecure,
} from "@/lib/auth/session";
import { buildLocalSession, getRestaurantUser } from "@/lib/auth/sasi-session";
import {
  SSO_COOKIE_NAMES,
  SSO_REDIRECT_URI_COOKIE,
  SSO_RETURN_TO_COOKIE,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
  getSsoRedirectUri,
} from "@/lib/auth/sso";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { getSasiSsoConfig, sasiTokenRequest } from "@/lib/sasi";
import { logger } from "@/lib/logger";
import { auditLogSafe, getAuditContext } from "@/lib/audit";
import { ensureLocalUserFromSasi } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function clearSsoCookies(response: NextResponse) {
  for (const name of SSO_COOKIE_NAMES) {
    response.cookies.delete(name);
  }
}

function errorResponse(message: string, status = 400) {
  const response = NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
  clearSsoCookies(response);
  return response;
}

export async function POST(request: NextRequest) {
  const auditContext = getAuditContext(request);
  let body: { code?: unknown; state?: unknown } | null = null;
  try {
    body = (await request.json()) as { code?: unknown; state?: unknown };
  } catch {
    body = null;
  }

  const code = typeof body?.code === "string" ? body.code : "";
  const state = typeof body?.state === "string" ? body.state : "";
  const cookieState = request.cookies.get(SSO_STATE_COOKIE)?.value;
  const verifier = request.cookies.get(SSO_VERIFIER_COOKIE)?.value;
  const redirectUri =
    request.cookies.get(SSO_REDIRECT_URI_COOKIE)?.value ||
    getSsoRedirectUri(request);
  const returnTo = getSafeRedirect(
    request.cookies.get(SSO_RETURN_TO_COOKIE)?.value
  );

  if (!code || !state || !cookieState || state !== cookieState) {
    await auditLogSafe(
      {
        accion: "auth.login.failed",
        entidad: "Auth",
        motivo: "Solicitud SSO inválida o expirada (state)",
      },
      auditContext
    );
    return errorResponse(
      "La solicitud de acceso no es válida o expiró. Inicia sesión nuevamente."
    );
  }

  if (!verifier) {
    await auditLogSafe(
      {
        accion: "auth.login.failed",
        entidad: "Auth",
        motivo: "Verificador PKCE no encontrado",
      },
      auditContext
    );
    return errorResponse(
      "No se encontró el verificador PKCE. Inicia sesión nuevamente."
    );
  }

  try {
    const config = getSasiSsoConfig();
    const { ok, data } = await sasiTokenRequest({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });

    if (!ok || data.success !== true) {
      const message =
        (typeof data.error_description === "string" && data.error_description) ||
        (typeof data.message === "string" && data.message) ||
        "No se pudo validar el acceso con SASI.";
      logger.warn("SSO: canje de código rechazado", {
        error: data.error,
        message,
      });
      await auditLogSafe(
        {
          accion: "auth.login.failed",
          entidad: "Auth",
          motivo: message,
        },
        auditContext
      );
      return errorResponse(message, 400);
    }

    const usuario = getRestaurantUser(data);
    if (!usuario) {
      await auditLogSafe(
        {
          accion: "auth.login.failed",
          entidad: "Auth",
          motivo: "Sin acceso activo al Sistema de Restaurante",
        },
        auditContext
      );
      return errorResponse(
        "Tu usuario no tiene acceso activo al Sistema de Restaurante.",
        403
      );
    }

    const sessionData = buildLocalSession(usuario, "sso");
    if (!sessionData) {
      await auditLogSafe(
        {
          accion: "auth.login.failed",
          entidad: "Auth",
          motivo: "No se pudo construir la sesión del usuario",
        },
        auditContext
      );
      return errorResponse(
        "No se pudo construir la sesión del usuario.",
        400
      );
    }

    await ensureLocalUserFromSasi({
      sub: sessionData.sub,
      nombre: sessionData.nombre,
      rolSasi: sessionData.rol,
    }).catch((error) => {
      logger.error("No se pudo preparar el usuario local", { error });
    });

    await auditLogSafe(
      {
        actor: {
          sub: sessionData.sub,
          nombre: sessionData.nombre,
          rol: sessionData.rol,
        },
        accion: "auth.login.success",
        entidad: "Auth",
        entidadId: sessionData.sub,
        motivo: "Inicio de sesión SSO",
      },
      auditContext
    );

    const sessionToken = await createSessionToken(sessionData);
    const redirectTo = returnTo || sessionData.home || "/dashboard";

    const response = NextResponse.json(
      {
        success: true,
        usuario,
        redirectTo,
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isSessionCookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    clearSsoCookies(response);
    return response;
  } catch (error) {
    logger.error("SSO: error al canjear el código", { error });
    await auditLogSafe(
      {
        accion: "auth.login.failed",
        entidad: "Auth",
        motivo: "Error al conectar con SASI durante el SSO",
      },
      auditContext
    );
    return errorResponse(
      "No se pudo conectar con SASI. Verifica que el servicio esté disponible.",
      502
    );
  }
}
