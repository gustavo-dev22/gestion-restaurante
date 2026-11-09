import { NextResponse } from "next/server";
import {
  SSO_REDIRECT_URI_COOKIE,
  SSO_RETURN_TO_COOKIE,
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
  generateSsoSecrets,
  getSsoRedirectUri,
  ssoCookieOptions,
} from "@/lib/auth/sso";
import { getSasiSsoConfig, sasiPing } from "@/lib/sasi";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

function errorRedirect(request: Request, code: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const returnTo = getSafeRedirect(url.searchParams.get("redirect"));

    if (process.env.SASI_SSO_SKIP_PING !== "true") {
      const disponible = await sasiPing();
      if (!disponible) {
        logger.warn("SSO: SASI no responde al ping, se cancela el inicio de sesión.");
        return errorRedirect(request, "sasi_unavailable");
      }
    }

    const config = getSasiSsoConfig();
    const redirectUri = getSsoRedirectUri(request);
    const { state, verifier, challenge } = generateSsoSecrets();

    const destino = new URL(config.loginUrl);
    destino.searchParams.set("client_id", config.clientId);
    destino.searchParams.set("returnUrl", redirectUri);
    destino.searchParams.set("state", state);
    destino.searchParams.set("code_challenge", challenge);
    destino.searchParams.set("code_challenge_method", "S256");

    const response = NextResponse.redirect(destino);
    response.headers.set("Cache-Control", "no-store");

    const options = ssoCookieOptions();
    response.cookies.set({ name: SSO_STATE_COOKIE, value: state, ...options });
    response.cookies.set({ name: SSO_VERIFIER_COOKIE, value: verifier, ...options });
    response.cookies.set({
      name: SSO_REDIRECT_URI_COOKIE,
      value: redirectUri,
      ...options,
    });
    if (returnTo) {
      response.cookies.set({
        name: SSO_RETURN_TO_COOKIE,
        value: returnTo,
        ...options,
      });
    }

    return response;
  } catch (error) {
    logger.error("SSO: no se pudo iniciar el flujo", { error });
    return errorRedirect(request, "sso_config");
  }
}
