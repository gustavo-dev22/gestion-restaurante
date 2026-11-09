# Integración SSO con SASI

> Flujo de inicio de sesión único (authorization code + PKCE) entre Gestión Restaurante y SASI.
> Última actualización: noviembre 2026.

## 1. Flujo

```text
Navegador                    Gestión Restaurante                 SASI
    |                                  |                          |
    |-- GET /api/auth/sso/start ------>|                          |
    |                                  |-- GET /SASI/api/auth/ping ->|
    |<-- 302 a /SASI/Cuenta/Login -----|                          |
    |     (client_id, returnUrl,                                   |
    |      state, code_challenge)                                  |
    |------------------------------------------------------------->|
    |                        login de credenciales                 |
    |<-- 302 a /sso-callback?code=...&state=... -------------------|
    |                                  |                          |
    |-- POST /api/auth/sso/callback -->|                          |
    |     { code, state }              |-- POST /SASI/api/auth/token
    |                                  |   { grant_type, client_id,
    |                                  |     code, code_verifier,
    |                                  |     redirect_uri } ------>|
    |                                  |<-- { success, usuario } --|
    |<-- cookie gr_session + usuario --|                          |
    |-- setAuth(usuario) + redirect -->|                          |
```

- El **code_verifier** y el **state** se guardan en cookies httpOnly de corta duración.
- El canje del código ocurre **en el servidor de Next.js**; el token de SASI no se expone al navegador.
- La sesión local (`gr_session`) se firma con `AUTH_SECRET` y mantiene el RBAC actual.

## 2. Registro del cliente en SASI

SASI debe tener un cliente SSO con `ClientId = restaurante` y `IdSistema = 13`.

### 2.1 Configuración declarativa

En `Sso:Clientes` de `appsettings.json` (SASI):

```json
{
  "ClientId": "restaurante",
  "IdSistema": 13,
  "RedirectUris": [
    "http://localhost:4206/sso-callback",
    "http://127.0.0.1:4206/sso-callback"
  ],
  "RequierePkce": true
}
```

El `SsoClienteSeeder` sincroniza esta configuración con la tabla `SistemaCliente`
al iniciar SASI en Development o cuando `Database:ApplyMigrationsOnStartup=true`.

### 2.2 Registro directo en base de datos

Si SASI ya está en ejecución, la fila debe existir en `SistemaCliente`:

```sql
INSERT INTO SistemaCliente
  (IdSistema, ClientId, ClientSecretHash, RedirectUris, RequierePkce, Activo,
   AuditUsuarioCreacion, AuditFechaCreacion)
VALUES
  (13, 'restaurante', NULL,
   'http://localhost:4206/sso-callback;http://127.0.0.1:4206/sso-callback',
   1, 1, 'integration-setup', GETDATE());
```

Para producción, agregar la URL pública exacta, por ejemplo:

```text
https://restaurante.midominio.com/sso-callback
```

SASI no acepta comodines en producción.

## 3. Variables de entorno

```env
NEXT_PUBLIC_SASI_API=https://localhost:44337/SASI/api
SASI_SSO_CLIENT_ID=restaurante

# Opcionales: se derivan de NEXT_PUBLIC_SASI_API si no se definen.
# SASI_SSO_LOGIN_URL=https://localhost:44337/SASI/Cuenta/Login
# SASI_SSO_TOKEN_URL=https://localhost:44337/SASI/api/auth/token
# SASI_SSO_LOGOUT_URL=https://localhost:44337/SASI/Cuenta/Logout
# SASI_SSO_PING_URL=https://localhost:44337/SASI/api/auth/ping
# SASI_SSO_REDIRECT_URI=http://localhost:4206/sso-callback

# Solo desarrollo: permite el certificado auto-firmado de SASI.
SASI_INSECURE_TLS=true
```

En producción:

- `SASI_INSECURE_TLS` debe ser `false`.
- `SASI_SSO_REDIRECT_URI` debe coincidir exactamente con la URI registrada.
- `SESSION_COOKIE_SECURE=true`.
- El sitio debe servirse por HTTPS.

## 4. Endpoints implementados

| Ruta | Método | Función |
|---|---|---|
| `/api/auth/sso/start` | GET | Genera PKCE/state, guarda cookies y redirige a SASI |
| `/api/auth/sso/callback` | POST | Valida state, canjea el code y crea `gr_session` |
| `/sso-callback` | GET | Página que completa el flujo y llena el store del cliente |
| `/api/auth/logout` | POST | Cierra sesión local y devuelve la URL de logout SSO |

## 5. Seguridad

- PKCE `S256` obligatorio.
- `state` de un solo uso con comparación contra cookie httpOnly.
- Cookies SSO con `httpOnly`, `SameSite=Lax`, `Secure` según entorno y TTL de 5 minutos.
- Redirecciones internas sanitizadas (sin `//`, sin URLs absolutas).
- Validación de acceso activo al sistema 13 antes de crear la sesión.
- El token de SASI no se guarda ni se expone en el navegador.
- Logout SSO: limpia la sesión local y cierra la sesión SSO de SASI sin afectar la consola SASI.

## 6. Prueba local

1. Verificar que SASI esté disponible:
   ```bash
   curl -k https://localhost:44337/SASI/api/auth/ping
   ```
2. Iniciar la app:
   ```bash
   npm run dev
   ```
3. Abrir `http://localhost:4206/login` y pulsar **Iniciar sesión con SASI**.
4. Autenticarse en SASI.
5. La app debe volver a `/sso-callback`, crear `gr_session` y redirigir al panel.

Si SASI no responde, el inicio se cancela y el login muestra un aviso.

## 7. Pendientes recomendados

- Registrar la URI de producción en `SistemaCliente`.
- Definir un plan de refresh/revocación de sesión si se requiere mayor seguridad.
- Extender la auditoría de accesos SSO (fecha, IP, usuario).
