"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, User, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { getHomePath, type AuthUserLike } from "@/lib/roles";
import { http } from "@/lib/http";
import { getSafeRedirect } from "@/lib/safe-redirect";
import { validateLogin, type LoginErrors } from "@/lib/validation";
import { Input } from "@/components/ui/Input";
import { Label, FieldError } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<LoginErrors>({});

  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const { isAuthenticated, hasHydrated, user } = useAuthStore();
  const router = useRouter();

  const getLoginRedirect = () =>
    getSafeRedirect(new URLSearchParams(window.location.search).get("redirect"));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (!code) return;

    const description = params.get("error_description");
    const mensajes: Record<string, string> = {
      sasi_unavailable:
        "No se pudo conectar con SASI. Verifica que el servicio esté disponible e inténtalo nuevamente.",
      sso_config:
        "La integración con SASI no está configurada correctamente. Contacta al administrador.",
    };
    setSsoError(description || mensajes[code] || "No se pudo iniciar sesión con SASI.");
  }, []);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    let active = true;
    // Valida que la cookie de sesión siga vigente antes de redirigir.
    http
      .get("/api/auth/session", { skipAuthRedirect: true })
      .then(() => {
        if (active) router.replace(getLoginRedirect() ?? getHomePath(user));
      })
      .catch(() => {
        if (active) logout();
      });

    return () => {
      active = false;
    };
  }, [hasHydrated, isAuthenticated, user, router, logout]);

  const validate = () => {
    const next = validateLogin({ username, password });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSso = () => {
    setSsoError(null);
    setErrors({});
    setSsoLoading(true);
    const redirect = getLoginRedirect();
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    window.location.assign(`/api/auth/sso/start${query}`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setSsoError(null);
    setIsLoading(true);
    setErrors({});

    try {
      const data = await http.post<{
        success: boolean;
        message?: string;
        usuario?: AuthUserLike;
      }>("/api/auth/login", { username: username.trim(), password }, { skipAuthRedirect: true });

      if (data.success) {
        if (!data.usuario) {
          setErrors({ form: "Respuesta inválida del servidor." });
          return;
        }
        setAuth(data.usuario);
        router.replace(getLoginRedirect() ?? getHomePath(data.usuario));
      } else {
        setErrors({ form: data.message || "Usuario o contraseña incorrectos." });
      }
    } catch {
      setErrors({ form: "No se pudo conectar con el servidor. Verifica tu conexión." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-800">Gestión Restaurante</h1>
            <p className="mt-2 text-slate-600">Gestión Centralizada SASI</p>
          </div>

          <Button
            type="button"
            size="lg"
            className="mb-5 w-full"
            onClick={handleSso}
            loading={ssoLoading}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            Iniciar sesión con SASI
          </Button>

          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              o usa tus credenciales
            </span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          {ssoError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{ssoError}</span>
            </div>
          )}

          {errors.form && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{errors.form}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <Label htmlFor="username" required>
                Usuario
              </Label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Usuario SASI"
                  className="pl-10"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  error={Boolean(errors.username)}
                  aria-describedby={errors.username ? "username-error" : undefined}
                  aria-required="true"
                />
              </div>
              {errors.username && <FieldError id="username-error">{errors.username}</FieldError>}
            </div>

            <div>
              <Label htmlFor="password" required>
                Contraseña
              </Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-10 pr-11"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  error={Boolean(errors.password)}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <FieldError id="password-error">{errors.password}</FieldError>}
            </div>

            <Button type="submit" size="lg" className="w-full" loading={isLoading}>
              {isLoading ? "Autenticando..." : "Entrar al Sistema"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
