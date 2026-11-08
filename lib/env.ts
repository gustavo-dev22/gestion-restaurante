const REQUIRED_VARS = ["DATABASE_URL", "NEXT_PUBLIC_SASI_API", "AUTH_SECRET"] as const;
const DEV_FALLBACK_SECRET = "dev-only-insecure-secret-change-me";

/**
 * Valida variables críticas al arrancar el servidor.
 * En producción falla de forma cerrada ante configuraciones inseguras.
 */
export function validateEnv() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `[env] Faltan variables de entorno obligatorias: ${missing.join(", ")}. Revisa .env.example.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (process.env.AUTH_SECRET === DEV_FALLBACK_SECRET || (process.env.AUTH_SECRET?.length ?? 0) < 32) {
      throw new Error(
        "[env] AUTH_SECRET es insegura. Define una clave aleatoria de al menos 32 caracteres en producción."
      );
    }

    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
      throw new Error(
        "[env] NODE_TLS_REJECT_UNAUTHORIZED=0 no está permitido en producción. Usa certificados válidos."
      );
    }
  }
}
