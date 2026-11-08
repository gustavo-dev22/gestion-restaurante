/**
 * Sesión propia firmada (HMAC-SHA256) compatible con Edge Runtime.
 * El token se guarda en una cookie httpOnly y nunca se expone al JavaScript del cliente.
 */

export const SESSION_COOKIE = "gr_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

export interface SessionPayload {
  sub: string;
  nombre: string;
  rol: string;
  home: string;
  sections: string[];
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret() {
  return process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  maxAgeSeconds = SESSION_MAX_AGE
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = { ...payload, iat: now, exp: now + maxAgeSeconds };
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const unsigned = `${header}.${body}`;
  const key = await getKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(parts[2]),
      encoder.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(parts[1]))) as SessionPayload;
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!Array.isArray(payload.sections)) return null;

    return payload;
  } catch {
    return null;
  }
}

function readCookie(cookieHeader: string, name: string) {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = readCookie(cookieHeader, SESSION_COOKIE);
  return verifySessionToken(token);
}
