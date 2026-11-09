import { createHash, randomBytes } from "node:crypto";
import { isSessionCookieSecure } from "@/lib/auth/session";

export const SSO_STATE_COOKIE = "gr_sso_state";
export const SSO_VERIFIER_COOKIE = "gr_sso_verifier";
export const SSO_REDIRECT_URI_COOKIE = "gr_sso_redirect_uri";
export const SSO_RETURN_TO_COOKIE = "gr_sso_return_to";
export const SSO_COOKIE_MAX_AGE = 300;

function base64Url(value: Buffer): string {
  return value.toString("base64url");
}

export function generateSsoSecrets() {
  const state = base64Url(randomBytes(16));
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { state, verifier, challenge };
}

/**
 * URI de callback registrada en SASI. Se puede forzar con
 * SASI_SSO_REDIRECT_URI; si no, se deriva del origen de la petición.
 */
export function getSsoRedirectUri(request: Request): string {
  const configured = process.env.SASI_SSO_REDIRECT_URI?.trim();
  if (configured) return configured;

  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}/sso-callback`;
}

export function getRequestOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

export function ssoCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSessionCookieSecure(),
    path: "/",
    maxAge: SSO_COOKIE_MAX_AGE,
  };
}

export const SSO_COOKIE_NAMES = [
  SSO_STATE_COOKIE,
  SSO_VERIFIER_COOKIE,
  SSO_REDIRECT_URI_COOKIE,
  SSO_RETURN_TO_COOKIE,
] as const;
