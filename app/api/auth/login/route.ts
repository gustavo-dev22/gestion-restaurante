import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
} from "@/lib/auth/session";
import { getHomePath, getRoleName, getSections, type AuthUserLike } from "@/lib/roles";
import { sasiLoginRequest } from "@/lib/sasi";

const SYSTEM_ID = 13;

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const { data } = await sasiLoginRequest(body);

    if (!data.success) {
      return NextResponse.json(
        { success: false, message: "Usuario o contraseña incorrectos." },
        { status: 200 }
      );
    }

    const usuario = data.usuario as AuthUserLike;

    const tieneAcceso = usuario?.sistemas?.some(
      (sistema) => sistema.id === SYSTEM_ID && (sistema as { activo?: boolean }).activo
    );

    if (!tieneAcceso) {
      return NextResponse.json(
        {
          success: false,
          message: "Acceso denegado: No tienes permisos para el Sistema de Restaurante.",
        },
        { status: 200 }
      );
    }

    const home = getHomePath(usuario);
    let sections = getSections(usuario);

    // Fallback: deriva la sección desde la vista de inicio si SASI no trae menús.
    if (sections.length === 0) {
      const segment = home.split("/").filter(Boolean)[0];
      if (segment) sections = [segment];
    }

    const sessionToken = await createSessionToken({
      sub: String(usuario.id ?? ""),
      nombre: usuario.nombreCompleto ?? "Usuario",
      rol: getRoleName(usuario),
      home,
      sections,
    });

    const json = NextResponse.json({ success: true, usuario }, { status: 200 });
    json.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return json;
  } catch {
    return NextResponse.json(
      { success: false, message: "Error de comunicación con SASI" },
      { status: 200 }
    );
  }
}
