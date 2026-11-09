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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Solicitud de inicio de sesión inválida." },
        { status: 400 }
      );
    }

    const { data } = await sasiLoginRequest(body);

    if (!data.success) {
      return NextResponse.json(
        { success: false, message: "Usuario o contraseña incorrectos." },
        { status: 200 }
      );
    }

    const usuario = getRestaurantUser(data);
    if (!usuario) {
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
      return NextResponse.json(
        { success: false, message: "No se pudo construir la sesión del usuario." },
        { status: 200 }
      );
    }

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
    return NextResponse.json(
      { success: false, message: "Error de comunicación con SASI" },
      { status: 200 }
    );
  }
}
