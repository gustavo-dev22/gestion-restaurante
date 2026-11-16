import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isSessionCookieSecure,
} from "@/lib/auth/session";
import { buildLocalSession, getRestaurantUser } from "@/lib/auth/sasi-session";
import { sasiLoginRequest } from "@/lib/sasi";
import { logger } from "@/lib/logger";
import { auditLogSafe, getAuditContext } from "@/lib/audit";
import { ensureLocalUserFromSasi } from "@/lib/rbac";
import { parseJson, loginSchema } from "@/lib/api-validation";

export async function POST(request: Request) {
  const auditContext = getAuditContext(request);

  try {
    const parsed = await parseJson(request, loginSchema);
    if (!parsed.success) {
      await auditLogSafe(
        {
          accion: "auth.login.failed",
          entidad: "Auth",
          motivo: "Solicitud de inicio de sesión inválida",
        },
        auditContext
      );
      return parsed.response;
    }
    const body = parsed.data;
    const username = body.username;

    const { data } = await sasiLoginRequest(body);

    if (!data.success) {
      await auditLogSafe(
        {
          actor: { nombre: username, sub: null, rol: null },
          accion: "auth.login.failed",
          entidad: "Auth",
          entidadId: username,
          motivo: "Usuario o contraseña incorrectos",
        },
        auditContext
      );
      return NextResponse.json(
        { success: false, message: "Usuario o contraseña incorrectos." },
        { status: 200 }
      );
    }

    const usuario = getRestaurantUser(data);
    if (!usuario) {
      await auditLogSafe(
        {
          actor: { nombre: username, sub: null, rol: null },
          accion: "auth.login.failed",
          entidad: "Auth",
          entidadId: username,
          motivo: "Sin acceso activo al Sistema de Restaurante",
        },
        auditContext
      );
      return NextResponse.json(
        {
          success: false,
          message: "Acceso denegado: No tienes permisos para el Sistema de Restaurante.",
        },
        { status: 200 }
      );
    }

    const sessionData = buildLocalSession(usuario, "direct");
    if (!sessionData) {
      await auditLogSafe(
        {
          actor: { nombre: username, sub: null, rol: null },
          accion: "auth.login.failed",
          entidad: "Auth",
          entidadId: username,
          motivo: "No se pudo construir la sesión del usuario",
        },
        auditContext
      );
      return NextResponse.json(
        { success: false, message: "No se pudo construir la sesión del usuario." },
        { status: 200 }
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
        motivo: "Inicio de sesión directo",
      },
      auditContext
    );

    const sessionToken = await createSessionToken(sessionData);

    const json = NextResponse.json({ success: true, usuario }, { status: 200 });
    json.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isSessionCookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return json;
  } catch (error) {
    logger.error("Error de comunicación con SASI", { error });
    await auditLogSafe(
      {
        accion: "auth.login.failed",
        entidad: "Auth",
        motivo: "Error de comunicación con SASI durante el login",
      },
      auditContext
    );
    return NextResponse.json(
      { success: false, message: "Error de comunicación con SASI" },
      { status: 200 }
    );
  }
}
