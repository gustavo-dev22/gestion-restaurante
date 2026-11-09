import https from "node:https";

export interface SasiResponse {
  ok: boolean;
  data: Record<string, unknown>;
}

export interface SasiSsoConfig {
  clientId: string;
  loginUrl: string;
  tokenUrl: string;
  logoutUrl: string;
  pingUrl: string;
}

export function getSasiApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_SASI_API?.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("NEXT_PUBLIC_SASI_API no está configurada");
  return baseUrl;
}

/**
 * URLs del flujo SSO. Por defecto se derivan de NEXT_PUBLIC_SASI_API,
 * pero pueden sobrescribirse con variables SASI_SSO_*.
 */
export function getSasiSsoConfig(): SasiSsoConfig {
  const apiBase = getSasiApiBaseUrl();
  const apiUrl = new URL(apiBase);
  const origen = apiUrl.origin;
  const apiPath = apiUrl.pathname.replace(/\/+$/, "");
  const sasiRoot = apiPath.replace(/\/api$/i, "");

  return {
    clientId: process.env.SASI_SSO_CLIENT_ID?.trim() || "restaurante",
    loginUrl:
      process.env.SASI_SSO_LOGIN_URL?.trim() ||
      `${origen}${sasiRoot}/Cuenta/Login`,
    tokenUrl:
      process.env.SASI_SSO_TOKEN_URL?.trim() || `${origen}${apiPath}/auth/token`,
    logoutUrl:
      process.env.SASI_SSO_LOGOUT_URL?.trim() ||
      `${origen}${sasiRoot}/Cuenta/Logout`,
    pingUrl:
      process.env.SASI_SSO_PING_URL?.trim() || `${origen}${apiPath}/auth/ping`,
  };
}

function deberiaPermitirTlsInseguro() {
  return (
    process.env.SASI_INSECURE_TLS === "true" && process.env.NODE_ENV !== "production"
  );
}

/**
 * Petición JSON a SASI con timeout. Si SASI usa un certificado auto-firmado
 * en desarrollo, se puede permitir con SASI_INSECURE_TLS=true (nunca en producción).
 */
export async function sasiRequest(
  url: string,
  {
    method = "GET",
    body,
    timeoutMs = 10_000,
  }: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}
): Promise<SasiResponse> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const headers: Record<string, string> = {};
  if (payload !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(Buffer.byteLength(payload));
  }

  if (deberiaPermitirTlsInseguro() && url.startsWith("https://")) {
    return new Promise<SasiResponse>((resolve, reject) => {
      const target = new URL(url);
      const request = https.request(
        {
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method,
          headers,
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        (response) => {
          let raw = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            raw += chunk;
          });
          response.on("end", () => {
            let data: Record<string, unknown> = {};
            try {
              data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            } catch {
              data = {};
            }
            const status = response.statusCode ?? 500;
            resolve({ ok: status >= 200 && status < 300, data });
          });
        }
      );

      request.on("timeout", () => {
        request.destroy(new Error("Timeout de conexión con SASI"));
      });
      request.on("error", reject);
      if (payload !== undefined) request.write(payload);
      request.end();
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
      cache: "no-store",
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  } finally {
    clearTimeout(timeout);
  }
}

/** Login directo contra SASI (usuario y contraseña). */
export async function sasiLoginRequest(payload: unknown): Promise<SasiResponse> {
  const baseUrl = getSasiApiBaseUrl();
  return sasiRequest(`${baseUrl}/Auth/login`, { method: "POST", body: payload });
}

/** Canje del authorization code (SSO). */
export async function sasiTokenRequest(payload: unknown): Promise<SasiResponse> {
  const { tokenUrl } = getSasiSsoConfig();
  return sasiRequest(tokenUrl, { method: "POST", body: payload });
}

/** Comprueba que SASI esté disponible antes de iniciar el SSO. */
export async function sasiPing(): Promise<boolean> {
  try {
    const { pingUrl } = getSasiSsoConfig();
    const response = await sasiRequest(pingUrl, { timeoutMs: 4_000 });
    return response.ok;
  } catch {
    return false;
  }
}

/** URL de cierre de sesión SSO con retorno a la app. */
export function buildSasiLogoutUrl(returnUrl: string): string {
  const { logoutUrl } = getSasiSsoConfig();
  return `${logoutUrl}?returnUrl=${encodeURIComponent(returnUrl)}`;
}
