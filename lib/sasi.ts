import https from "node:https";

export interface SasiResponse {
  ok: boolean;
  data: Record<string, unknown>;
}

/**
 * Llama al endpoint de login de SASI.
 * Si SASI usa un certificado auto-firmado en desarrollo, se puede permitir
 * únicamente para esta petición con SASI_INSECURE_TLS=true (nunca en producción).
 */
export async function sasiLoginRequest(payload: unknown): Promise<SasiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_SASI_API;
  if (!baseUrl) throw new Error("NEXT_PUBLIC_SASI_API no está configurada");

  const url = `${baseUrl}/Auth/login`;
  const body = JSON.stringify(payload);
  const allowInsecureTls =
    process.env.SASI_INSECURE_TLS === "true" && process.env.NODE_ENV !== "production";

  if (!allowInsecureTls) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: response.ok, data };
  }

  const target = new URL(url);

  return new Promise<SasiResponse>((resolve, reject) => {
    const request = https.request(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        rejectUnauthorized: false, // Solo para el certificado self-signed de SASI en desarrollo.
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

    request.on("error", reject);
    request.write(body);
    request.end();
  });
}
