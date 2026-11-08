# Re-auditoría Crítica — Estado Actual tras las 5 Fases

> Auditoría técnica de UI/UX, accesibilidad, seguridad y arquitectura sobre el sistema de gestión de restaurantes.
> Fecha de referencia: noviembre 2026.
> Alcance: revisión del código actual y verificación directa de la base de datos cuando fue posible.

## Resumen ejecutivo

Las cinco fases mejoraron sustancialmente la experiencia de usuario, la accesibilidad y la consistencia visual. Sin embargo, la re-auditoría detectó **bloqueadores críticos de seguridad, integridad de datos y lógica de negocio** que impiden considerar el sistema listo para producción.

Veredicto: **no apto para un despliegue definitivo** en su estado actual. Puede operar como **piloto controlado en una sola red local** con supervisión, tras corregir los puntos P0.

---

## 1. Matriz de puntuación reevaluada

| Dimensión | Inicial | Actual | Δ | % hacia producción |
|---|---:|---:|---:|---:|
| Consistencia visual | 5 | 8.5 | +3.5 | 85% |
| Responsive / Tablet | 3 | 8.5 | +5.5 | 85% |
| Accesibilidad (WCAG) | 2 | 7.0 | +5.0 | 70% |
| Formularios / Feedback | 5 | 8.0 | +3.0 | 80% |
| Estados de carga / error | 4 | 8.0 | +4.0 | 80% |
| Flujos por rol | 6 | 6.0 | 0.0 | 60% |
| Rendimiento percibido | 4 | 7.5 | +3.5 | 75% |
| **Seguridad / RBAC** (nueva) | — | **2.5** | — | **25%** |
| **Calidad / deuda técnica** (nueva) | — | 5.5 | — | 55% |

- **UI/UX global (7 dimensiones): 7.6/10** (subió desde 4.8).
- **Global ponderado incluyendo seguridad y deuda: ~6.0/10**.
- **Preparación para producción: ~55–60%**.

Conclusión de puntaje: la **experiencia de usuario y el sistema de diseño están a nivel producción**; la **seguridad, integridad de datos y algunos flujos de negocio no**.

---

## 2. Regresiones y puntos ciegos detectados

### P0 — Bloqueantes de producción

1. **Las APIs no tienen autenticación ni autorización.**
   - Ningún endpoint valida sesión. El `token` de SASI se guarda pero **nunca se envía** (`lib/store.ts:6`, `lib/http.ts:54-73`). No existe `middleware.ts` ni verificación en rutas.
   - Cualquiera en la red puede llamar `/api/admin/*`, `/api/mesero/*`, `/api/cocina/*`.
   - El RBAC de `app/(dashboard)/layout.tsx` + `lib/roles.ts` es **solo visual en cliente**; no protege datos.

2. **Los pedidos QR no llegan a cocina (verificado en BD).**
   - `app/api/public/pedido/route.ts:47-51` crea detalles **sin `estado`** (queda `NULL`).
   - `app/api/cocina/comandas/route.ts:11` filtra `estado: { not: 'Listo' }`. En Prisma/SQL Server los `NULL` **no** cumplen ese filtro.
   - Consulta real: `NOT_LISTO` devolvió **0** filas habiendo **1** detalle con `estado=NULL`. Resultado: los pedidos del cliente digital no aparecen en Cocina, no se marcan listos y el cobro tampoco los bloquea (`pagar` solo busca estado `'Pendiente'`).

3. **Las reservas bloquean la mesa desde ya, aunque sean para otra fecha.**
   - `app/api/public/reservar/route.ts` marca la mesa como `Reservada` inmediatamente al crear la reserva.
   - Una reserva para dentro de un mes deja la mesa inutilizable hoy para pedidos digitales, y no hay proceso que la libere automáticamente.

4. **Integridad del cobro:**
   - `app/api/mesero/pedido/pagar/route.ts:6` recibe `metodoPago` y **lo ignora** (no se persiste); además permite pagar cualquier `pedidoId` sin validar estado ni dueño.
   - Totales y precios llegan del cliente (`public/pedido` y `pedido/detalle`) y se guardan sin recalcular contra `Producto.precio`. Se puede manipular el total o el precio unitario.

5. **“Llamar al mesero” se registra pero nadie lo ve.**
   - `app/api/public/llamar-mesero/route.ts` crea un `Pedido` con estado `Llamado`, pero **no existe UI ni endpoint que los consuma**. Operativamente el botón no llega a ningún mesero.
   - Además, esos registros **contaminan reportes**: `horas-pico` cuenta todos los pedidos. En BD hay **4 filas `Llamado`** incluidas en el histograma.

6. **Zona horaria dependiente del servidor.**
   - La corrección actual funciona porque el servidor está en Perú. Pero `new Date(fechaReserva)` (string `datetime-local` sin offset) se interpreta con la TZ del proceso (`public/reservar:13`, `public/reservas:16`). En un deploy UTC (Vercel/containers) las reservas se desfasarían 5 h.

### P1 — Importantes

7. **Concurrencia en pedidos públicos:** se crea el pedido y luego se valida que la mesa esté `Libre` dentro de la transacción; dos escaneos simultáneos pueden competir. Falta bloqueo/constraint.
8. **Stock sin control:** `pedido/detalle` decrementa stock sin validar disponibilidad; puede quedar negativo.
9. **Reportes con lógica imprecisa:** `personal` cuenta pedidos `Pendiente` como ventas (no solo `Pagado`); `ingenieria` usa márgenes simulados (40%, documentado).
10. **Imágenes:** `next.config.ts` usa `hostname: "**"`, habilitando el optimizador para cualquier host externo (riesgo de abuso/SSRF). Restringir a dominios conocidos o proxy propio.
11. **Entorno:** `.env.local` tiene `NODE_TLS_REJECT_UNAUTHORIZED=0`; **no debe llegar a producción**.
12. **Sin rate limiting** en endpoints públicos (`pedido`, `reservar`, `llamar-mesero`).
13. **PWA:** hay manifest/iconos, pero **no hay service worker**; además `start_url: "/"` redirige a `/login` y el login **no auto-redirige** a un usuario ya autenticado (la app instalada siempre abre en login).
14. **Sin migraciones Prisma** (`prisma/` solo contiene `schema.prisma`), lo que hace el despliegue no reproducible.

### P2 — Pulido

15. Reportes con gráficos sin alternativa accesible (tooltip solo hover, sin tabla/aria).
16. `@prisma/config ^7.4.1` conviviendo con `prisma 5.10.0` (dependencia innecesaria/desalineada).
17. Sin tests, CI ni monitoreo de errores.
18. 82 problemas de lint (`no-explicit-any`, avisos menores).

---

## 3. Calidad de código y deuda técnica

- **Positivo:** `lib/http` centralizado, `utils` de formato/TZ, sistema de UI propio, `Modal` con focus trap, `useDebounce`, `resolveIcon` con imports nombrados, singleton de Prisma correcto.
- **Deuda App Router:** todas las páginas son `"use client"` y cargan datos con `useEffect`; **no se aprovechan Server Components, caché/revalidación ni streaming**. Es aceptable para una app interna, pero queda lejos del patrón óptimo de Next App Router.
- **Datos:** `any` masivo, validación manual duplicada (sin Zod), lógica de negocio dispersa en rutas API, sin capa de servicios.
- **Tiempo real:** polling de 10–30 s en lugar de SSE/WebSocket; funcional, pero con carga y latencia.
- **RBAC:** correcto como **UX** (oculta/redirige), insuficiente como **seguridad**.

---

## 4. Veredicto de producción

**No está listo para un despliegue definitivo tal como está.** Puede operar en un **piloto controlado dentro de una sola red local**, con supervisión, pero no para uso público ni multi-sucursal.

**Bloqueadores que deben corregirse antes de producción (P0):**

1. Autenticación/autorización real en APIs (validar token SASI contra su backend o sesión httpOnly firmada) + `middleware`.
2. Inicializar `PedidoDetalle.estado = 'Pendiente'` al crear pedidos QR (o ajustar la query de cocina para incluir `NULL`), y bloquear pago hasta que todo esté listo.
3. Reservas: no marcar la mesa `Reservada` de inmediato; derivar disponibilidad por fecha/hora y liberar automáticamente.
4. Cobros: persistir método de pago, recalcular totales/precios en servidor y validar estado/dueño del pedido.
5. “Llamar mesero”: consumirlo en la UI de meseros y excluir `Llamado` de reportes (o modelo dedicado).
6. Parsear `datetime-local` explícitamente como `America/Lima` (independiente de la TZ del servidor).

**Recomendado para el “go-live”:**

- Restringir dominios de imagen.
- Eliminar `NODE_TLS_REJECT_UNAUTHORIZED=0` de producción.
- Agregar rate limiting.
- Migraciones Prisma versionadas.
- Service worker y auto-redirect de login para la PWA.
- Tests críticos (cobro, QR→cocina, RBAC).
- Monitoreo de errores.

---

## 5. Plan de remediación propuesto

### Fase P0 — Seguridad e integridad (prioridad máxima)

- Autenticación de APIs y middleware de sesión/RBAC.
- Corrección del estado de detalles QR y del flujo cocina → cobro.
- Lógica de reservas basada en fecha/hora y liberación automática.
- Persistencia de método de pago y recálculo de totales en servidor.
- Visibilidad real de “Llamar mesero” y limpieza de reportes.
- Parseo explícito de `datetime-local` en `America/Lima`.

### Fase P1 — Robustez

- Bloqueo/constraint de concurrencia en pedidos.
- Validación de stock.
- Rate limiting y hardening de imágenes/env.
- Migraciones Prisma y CI.

### Fase P2 — Calidad

- Tests, monitoreo, Server Components/caching, accesibilidad de gráficos, limpieza de dependencias y deuda de lint.

---

## 6. Decisión pendiente sobre autenticación de APIs

Opciones para resolver el bloqueador de seguridad:

1. **Validar el token de SASI** contra su endpoint en cada request (simple, acoplado a SASI).
2. **Sesión propia httpOnly** creada en el login (más robusta y desacoplada).
3. **Middleware híbrido** con el token SASI en cookie.

La opción recomendada es la **2**, con expiración y renovación controladas.
