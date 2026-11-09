import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  getSessionFromRequest,
  isSessionCookieSecure,
} from "@/lib/auth/session";
import { SSO_COOKIE_NAMES, getRequestOrigin } from "@/lib/auth/sso";
import { buildSasiLogoutUrl } from "@/lib/sasi";

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  let ssoLogoutUrl: string | undefined;
  if (session?.authMethod === "sso") {
    try {
      ssoLogoutUrl = buildSasiLogoutUrl(`${getRequestOrigin(request)}/login`);
    } catch {
      // Si SASI no está configurado, el logout local sigue funcionando.
    }
  }

  const response = NextResponse.json({ success: true, ssoLogoutUrl });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSessionCookieSecure(),
    path: "/",
    maxAge: 0,
  });

  for (const name of SSO_COOKIE_NAMES) {
    response.cookies.delete(name);
  }

  return response;
}
