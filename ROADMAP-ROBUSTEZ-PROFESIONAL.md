# Roadmap de Robustez Profesional

> Sistema de gestión de restaurantes: análisis de roles, funcionalidades faltantes y plan de evolución.
> Fecha de referencia: noviembre 2026.
> Alcance: revisión del código actual (roles, rutas API, modelo Prisma, reportes, seguridad y operación).
> Estado: documento de planificación. No implica cambios implementados.

---

## Contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Fortalezas actuales](#2-fortalezas-actuales)
3. [Roles actuales y alcance real](#3-roles-actuales-y-alcance-real)
4. [Funcionalidades faltantes por prioridad](#4-funcionalidades-faltantes-por-prioridad)
5. [Roles propuestos](#5-roles-propuestos)
6. [Modelo de permisos recomendado](#6-modelo-de-permisos-recomendado)
7. [Roadmap por fases](#7-roadmap-por-fases)
8. [Quick wins](#8-quick-wins)
9. [Modelo de datos propuesto](#9-modelo-de-datos-propuesto)
10. [Requisitos no funcionales](#10-requisitos-no-funcionales)
11. [Decisiones pendientes](#11-decisiones-pendientes)
12. [Recomendación de arranque](#12-recomendación-de-arranque)

---

## 1. Resumen ejecutivo

El sistema ya tiene una base sólida para operar: autenticación con cookie httpOnly, autorización en proxy, idempotencia en creación de pedidos, descuento atómico de stock, cola offline, PWA, SWR, paginación, caché, accesibilidad P3, tests unitarios, smoke de API y CI.

El gap principal ya no está en la interfaz. Está en **control operativo, trazabilidad y permisos finos**:

- No existe caja, turnos ni arqueo.
- No existe un registro de pagos; solo se marca el pedido como pagado.
- No hay auditoría de cambios sensibles.
- El permiso es por sección (`admin`, `mesero`, `cocina`), no por acción.
- El inventario es stock de producto terminado; no hay insumos, recetas ni movimientos.
- No hay notas por plato, modificadores, variantes, combos ni impuestos.
- No hay clientes, lealtad, delivery ni facturación electrónica.
- La sesión es stateless de 8 horas, sin revocación ni rotación.
- Los reportes usan costos simulados y no exportan.

La recomendación es priorizar **dinero y control** (Fase 4), luego **inventario y menú** (Fase 5), y finalmente **crecimiento** (Fase 6).

---

## 2. Fortalezas actuales

| Área | Implementado |
|---|---|
| Autenticación | Cookie httpOnly `gr_session`, HMAC-SHA256, validación en proxy y servidor |
| RBAC | Secciones `admin`, `mesero`, `cocina`; redirección y 403 |
| Idempotencia | `X-Idempotency-Key` en pedidos y comandas, tabla `Idempotency_Keys` con TTL |
| Stock | Descuento atómico con condición `stock >= cantidad` |
| QR | Pedidos QR, expiración de pedidos obsoletos, confirmación atómica por mesero |
| Reservas | Disponibilidad dinámica por fecha/hora; no bloquea la mesa de inmediato |
| Cobro | Recálculo de total en servidor y persistencia del método de pago |
| Llamados | Solicitud pública, listado/asignación en mesero |
| Offline | Service worker, cola offline, sincronización y reintentos |
| Rendimiento | SWR, paginación server-side, caché por tags, skeletons |
| Accesibilidad | Skip link, captions/aria-label, aria-describedby, focus trap, contraste |
| Calidad | TypeScript estricto, lint 0/0, tests unitarios, smoke de API, CI |
| Zona horaria | Utilidades explícitas para `America/Lima` |
| Rate limiting | Endpoints públicos de pedido, reserva, llamado y log |

Snapshot de verificación al crear este documento: `tsc` OK, lint 0/0, 29 tests en 10 archivos, build OK, smoke 22/22, CI en verde.

---

## 3. Roles actuales y alcance real

| Rol | Puede hacer hoy | Limitación principal |
|---|---|---|
| **Administrador** | Dashboard, ventas, carta (categorías/productos), mesas/QR, reservas, reportes (horas pico, ingeniería de menú, inventario, personal) | Todo o nada: no hay usuarios/roles locales, caja, auditoría, aprobaciones ni configuración por sucursal |
| **Mesero** | Salón, abrir mesa, tomar pedido, agregar platos, ver sus pedidos, resumen, cobrar, atender llamados | No puede transferir/unir mesas, dividir cuenta, agregar notas/modificadores, anular consumo con aprobación ni propina |
| **Cocina** | Comandas por área, marcar listo, activar/desactivar productos, ver stock | No ajusta cantidades, no registra merma, no ve recetas/insumos; KDS por polling sin tiempos ni prioridad |
| **Cliente (público)** | Menú QR, pedido, llamar mesero, reservar | Sin cuenta, historial, seguimiento, pagos, lealtad ni feedback |
| **SASI** | Identidad y menús; de ahí salen las secciones `admin`/`mesero`/`cocina` | El permiso es por sección, no por acción; un rol con un solo menú admin obtiene todo admin |

### 3.1 Lo que le falta a cada rol actual

**Administrador**
- Gestión de usuarios, roles y permisos.
- Auditoría y aprobaciones.
- Caja, turnos y arqueo.
- Configuración de impuestos, propinas, sucursal y numeración.
- Exportación de reportes y conciliación.
- Multi-sucursal si el negocio crece.

**Mesero**
- Transferir o unir mesas.
- Dividir cuenta por ítems o personas.
- Notas por plato y modificadores.
- Anular ítems con autorización.
- Propina y descuentos.
- Ver métricas propias del turno.
- Check-in de reservas y asignación de mesas.

**Cocina**
- KDS en tiempo real (SSE/WebSocket), cronómetros y SLA.
- Prioridad, recall, bump/undo.
- Notas del pedido y modificadores.
- Registrar merma y ajustar disponibilidad.
- Ver insumos y recetas.
- Enrutamiento por estación (cocina, bar, postres).

**Cliente**
- Seguimiento del pedido en tiempo real.
- Historial y recompra.
- Cuenta, puntos y cupones.
- Pago en línea.
- Feedback y reservas con recordatorio.

---

## 4. Funcionalidades faltantes por prioridad

### P0 — Sin esto no se considera profesional

#### 4.1 Caja y turnos

- Apertura y cierre de caja.
- Fondo inicial, ventas por método, retiros y gastos menores.
- Arqueo: esperado vs contado, diferencia y justificación.
- Cierre por turno y por cajero.
- Reporte de cierre imprimible.
- Hoy el pago solo cambia `Pedido.estado` y `metodoPago`; no hay entidad de pago ni turno.

**Criterio de aceptación**
- Un turno no puede cerrarse con pagos pendientes de conciliar.
- El cierre muestra totales por efectivo, tarjeta y billeteras.
- La diferencia queda registrada y auditada.

#### 4.2 Cobros completos

- Registro de pagos: monto, método, propina, descuento, referencia, cajero, turno, estado y timestamps.
- Pagos parciales y cuenta dividida por ítems/personas.
- Múltiples métodos en un mismo pedido.
- Propinas.
- Descuentos con motivo y autorización.
- Promociones y cupones.
- Anulación/devolución con motivo, autorización, reversión de stock y auditoría.
- Pago atómico e idempotente.
- Comprobante interno y, si aplica, boleta/factura electrónica.
- Integración con POS/pasarela o, como mínimo, código de autorización y conciliación para tarjeta/Yape/Plin.

**Criterio de aceptación**
- La suma de pagos de un pedido coincide con su total (o queda saldo explícito).
- Dos solicitudes simultáneas no generan doble cobro.
- Una devolución revierte el pago y deja traza.
- El cierre de caja cuadra con los pagos del turno.

#### 4.3 Auditoría y permisos reales

- Log inmutable de acciones sensibles.
- Registrar actor, fecha, IP, entidad, acción, valores antes/después y motivo.
- Auditar: precios, stock, descuentos, anulaciones, pagos, devoluciones, roles, mesas y reservas.
- Permisos por acción, no por sección.
- Roles locales superpuestos a SASI o migración a usuarios locales.
- UI de consulta y exportación de auditoría.

**Criterio de aceptación**
- Toda mutación sensible genera un registro.
- Un usuario sin `payments:refund` recibe 403 aunque su sección sea admin.
- Los cambios de rol se reflejan sin esperar la expiración de la sesión (si se usa sesión en DB).

#### 4.4 Integridad de datos y reglas de negocio

- Validación con Zod en todas las APIs.
- Restricciones DB: `stock >= 0`, `precio >= 0`, `total >= 0`, reserva única por mesa y franja.
- Historial de precios.
- Soft delete con motivo para entidades maestras.
- Estados de pedido más ricos: borrador, confirmado, en cocina, parcialmente listo, listo, servido, por cobrar, pagado, cerrado, anulado.
- Idempotencia en pagos, devoluciones y anulaciones.
- Control de concurrencia en reservas y cobros.

**Criterio de aceptación**
- No se puede guardar un precio o stock inválido.
- Dos reservas simultáneas para la misma mesa/franja fallan de forma controlada.
- El pago concurrente no duplica el cobro.

#### 4.5 Inventario real

- Hoy `Producto.stock` es stock del producto terminado; no hay insumos ni recetas.
- Insumos, recetas/BOM, unidades de medida, rendimiento y costo real.
- Movimientos: compra, consumo, merma, ajuste, transferencia y conteo físico.
- Proveedores, órdenes de compra, recepción y cuentas por pagar.
- Sugerencias de recompra y alertas de stock bajo.
- Reportes con costo real y margen real.
- Los reportes actuales usan costos simulados (60% de margen, 40% de costo).

**Criterio de aceptación**
- Una venta descuenta insumos según receta.
- Una merma queda registrada con motivo y responsable.
- El margen del reporte usa costo real, no un porcentaje fijo.

#### 4.6 Seguridad de sesión y operación

- Rate limit en login, bloqueo por intentos y auditoría de accesos.
- Sesión con revocación/rotación; evaluar sesiones en DB o token version.
- MFA para administrador/gerente.
- Headers CSP, HSTS, X-Frame-Options y CSRF explícito para mutaciones.
- Backups y restore probados.
- Health check.
- Monitoreo de errores (Sentry/APM), alertas y logs estructurados.
- E2E con Playwright para caja, cobro, QR→cocina, anulación y permisos.
- README/runbook real, Docker o guía de despliegue, seed/demo y staging.

**Criterio de aceptación**
- El login tiene límite de intentos y deja traza.
- Un logout invalida la sesión de inmediato.
- Existe un plan de restore probado.
- Los flujos críticos están cubiertos por E2E.

### P1 — Operación completa

#### 4.7 Menú configurable

- Modificadores: extras, sin ingrediente, término de cocción, acompañamientos.
- Variantes/tamaños con precio propio.
- Combos.
- Notas por ítem y por pedido.
- Alérgenos e información nutricional opcional.
- Disponibilidad por horario y por sucursal.
- Impuestos (IGV) incluidos o excluidos.
- Cargo por servicio y redondeo.
- Historial de precios y disponibilidad.

#### 4.8 KDS profesional

- Tiempo real con SSE/WebSocket.
- Cronómetros por plato y por pedido.
- Prioridad/rush.
- Recall, bump y undo.
- Notas y modificadores visibles.
- Sonido/notificación.
- Enrutamiento por estación (cocina, bar, postres).
- Métricas de tiempos de preparación y demoras.

#### 4.9 Mesas y salón

- Transferir mesas.
- Unir mesas.
- Mover ítems entre mesas.
- Dividir por asiento.
- Plano de salón editable.
- Estados automáticos según pedido y pago.
- Check-in de reservas.

#### 4.10 Reservas

- Calendario/timeline.
- Cupos por franja.
- Lista de espera.
- No-show.
- Check-in.
- Recordatorios por WhatsApp/SMS/email.
- Depósitos.
- Preferencias de mesa y ocasiones especiales.

#### 4.11 Clientes y CRM

- Ficha de cliente.
- Historial de pedidos.
- Preferencias y alergias.
- Direcciones.
- Puntos y cupones.
- Campañas.
- Feedback/NPS.
- Consentimiento y privacidad.

#### 4.12 Reportes y analítica

- Rango de fechas libre.
- Ventas por día, hora, categoría, producto, mesa, mesero, canal y método de pago.
- Impuestos, propinas, descuentos y devoluciones.
- COGS y margen real.
- Rotación de mesas y ticket promedio.
- Comparación entre periodos.
- Exportación CSV/Excel/PDF.
- Envío programado.
- Pronóstico de demanda.

#### 4.13 Impresión y notificaciones

- Tickets de cocina y recibos en impresora térmica (ESC/POS).
- No depender solo de `window.print()`.
- Llamados con sonido y push.
- Avisos de stock bajo.
- Alertas de pedidos demorados.

#### 4.14 Multi-sucursal

- Modelo `Sucursal`.
- Carta, precios, mesas, personal y reportes por sucursal.
- Roles por sucursal.
- Configuración de moneda, zona horaria, impuestos y numeración.
- Corte de día operativo configurable.

### P2 — Crecimiento

- Delivery/takeout con canales, direcciones, zonas, repartidores y seguimiento.
- Lealtad, promociones, marketing y encuestas.
- Facturación electrónica/SUNAT y conciliación contable.
- Integraciones con apps de delivery, pasarelas de pago y contabilidad.
- Pronóstico de demanda y optimización de carta.
- Analítica avanzada.
- i18n, modo oscuro, app móvil/PWA con push y multi-moneda.
- Feature flags y experimentación.

---

## 5. Roles propuestos

No conviene crear un rol por pantalla. Con **5 roles nuevos** bien definidos se cubre casi todo.

| Rol nuevo | Para qué | Permisos clave |
|---|---|---|
| **Gerente / Supervisor** | Operación diaria y aprobaciones | Reportes, descuentos/anulaciones, cierre de caja, personal; sin configuración de seguridad |
| **Cajero** | Cobros y caja | Pagos, división de cuenta, propinas, devoluciones, turno/arqueo, comprobantes |
| **Almacén / Inventario** | Stock e insumos | Insumos, recetas, compras, proveedores, mermas, conteos; sin ventas |
| **Host / Recepción** | Salón y reservas | Calendario, waitlist, check-in, asignar/transferir mesas |
| **Auditor / Contador** | Control y contabilidad | Reportes y auditoría en solo lectura, exportaciones |

Roles condicionales:

- **Repartidor:** solo si habrá delivery.
- **Cliente registrado:** solo si habrá historial, puntos o pagos en línea.
- **Bar/Postres:** no como rol; usar permisos/área dentro de Cocina.

### 5.1 Matriz de permisos propuesta

| Acción | Admin | Gerente | Cajero | Mesero | Cocina | Almacén | Host | Auditor |
|---|---|---|---|---|---|---|---|---|
| Configurar carta y precios | Sí | Aprobación | No | No | No | No | No | Lectura |
| Abrir/modificar pedidos | Sí | Sí | No | Propios | No | No | No | No |
| Anular/descuento | Sí | Sí | Solicita | Solicita | No | No | No | No |
| Cobrar/dividir/propina | Sí | Sí | Sí | Propios | No | No | No | No |
| Caja/turno/arqueo | Sí | Cierre | Sí | No | No | No | No | Lectura |
| Inventario/compras | Sí | Lectura | No | No | Merma/86 | Sí | No | Lectura |
| Reservas/salón | Sí | Sí | No | Check-in | No | No | Sí | Lectura |
| Reportes | Sí | Sí | Turno | No | No | Stock | Ocupación | Sí |
| Usuarios/roles | Sí | No | No | No | No | No | No | No |
| Auditoría | Sí | Lectura | No | No | No | No | No | Sí |

---

## 6. Modelo de permisos recomendado

### 6.1 Problema actual

Las secciones `admin`, `mesero` y `cocina` son demasiado gruesas. Un usuario con acceso a una sola pantalla administrativa obtiene acceso a todas las APIs administrativas.

### 6.2 Propuesta

- Definir permisos por acción:
  - `menu:read`, `menu:write`, `menu:price`, `menu:availability`
  - `orders:create`, `orders:read:own`, `orders:read:all`, `orders:add_item`
  - `orders:void_item`, `orders:cancel`, `orders:transfer`, `orders:merge`
  - `payments:create`, `payments:split`, `payments:tip`, `payments:discount`
  - `payments:refund`, `payments:void`, `cash:open`, `cash:close`
  - `tables:read`, `tables:assign`, `tables:transfer`, `tables:merge`, `tables:maintenance`
  - `reservations:read`, `reservations:write`, `reservations:cancel`
  - `inventory:read`, `inventory:adjust`, `inventory:purchase`, `inventory:count`
  - `reports:read`, `reports:export`, `reports:financial`
  - `users:read`, `users:manage`, `roles:manage`, `audit:read`, `settings:manage`
- Agrupar permisos en roles.
- Mantener SASI como identidad y agregar una capa local `Rol`/`Permiso`/`UsuarioRol` keyed por el `sub` de SASI.
- Evaluar sesiones en DB o `tokenVersion` para que los cambios de rol y el logout tengan efecto inmediato.
- Auditar toda asignación de rol y cambio de permiso.

### 6.3 Alternativa

Si se decide migrar fuera de SASI:

- Usuarios locales con hash de contraseña (Argon2/bcrypt).
- Recuperación de contraseña, MFA y bloqueo por intentos.
- Roles y permisos locales.
- Migración y convivencia temporal con SASI.

---

## 7. Roadmap por fases

### Fase 4 — Dinero y control (P0)

Objetivo: que el sistema pueda operar con dinero real, trazabilidad y delegación segura.

| # | Entregable | Depende de |
|---|---|---|
| 4.1 | Modelo de pagos + turnos de caja + arqueo | — |
| 4.2 | División de cuenta, propina, descuentos, anulaciones/devoluciones con aprobación | 4.1 |
| 4.3 | Auditoría inmutable | 4.1 |
| 4.4 | Permisos granulares + roles Gerente/Cajero | 4.3 |
| 4.5 | Validación Zod, constraints DB, pago idempotente/atómico, reservas concurrentes | — |
| 4.6 | Endurecimiento de sesión/login, headers, backups, health, monitoreo y E2E crítico | — |

**Resultado esperado**
- Caja cuadrada por turno.
- Cobros divididos y con propina.
- Anulaciones auditadas y autorizadas.
- Roles delegables sin dar acceso total.
- Datos inválidos bloqueados en API y DB.
- Operación observable y recuperable.

### Fase 5 — Inventario y menú (P1)

Objetivo: costos reales, carta flexible y operación de cocina profesional.

| # | Entregable | Depende de |
|---|---|---|
| 5.1 | Insumos, recetas, movimientos, proveedores/compras, mermas y conteos | 4.4, 4.5 |
| 5.2 | Modificadores, variantes, combos, notas, alérgenos, horarios e impuestos | 4.5 |
| 5.3 | Transferencia/unión de mesas y división por asiento | 4.2 |
| 5.4 | KDS con tiempos, prioridad y recall | 4.6 |
| 5.5 | Reportes con rango libre, márgenes reales y exportación | 5.1, 5.2 |

**Resultado esperado**
- Inventario por insumos y recetas.
- Margen real por plato.
- Carta configurable sin tocar código.
- Cocina con tiempos y prioridades.
- Reportes exportables y filtrables.

### Fase 6 — Crecimiento (P2)

Objetivo: captar y retener clientes, integrar canales y escalar.

| # | Entregable | Depende de |
|---|---|---|
| 6.1 | Reservas con calendario/waitlist/no-show/recordatorios y rol Host | 4.4 |
| 6.2 | Clientes, lealtad, feedback y campañas | 4.4 |
| 6.3 | Delivery/takeout y, si aplica, repartidor | 4.2, 5.2 |
| 6.4 | Facturación electrónica/SUNAT y conciliación | 4.1, 4.2 |
| 6.5 | Multi-sucursal, pronóstico e integraciones | 4.4, 5.1 |

**Resultado esperado**
- Canales de venta ampliados.
- Clientes recurrentes y medibles.
- Cumplimiento fiscal.
- Operación multi-sede.

---

## 8. Quick wins

Acciones de bajo esfuerzo y alto impacto para el primer sprint:

- [ ] Completar anulación/void con motivo, autorización y auditoría (hoy solo se anulan pedidos vacíos).
- [ ] Agregar notas por plato y por pedido.
- [ ] Ajuste de stock y merma desde Cocina con movimiento registrado.
- [ ] KPIs de ventas del día en el dashboard (hoy solo cuenta productos y mesas).
- [ ] Export CSV en ventas y reportes.
- [ ] Endpoint `/api/health`.
- [ ] Headers de seguridad (CSP, HSTS, X-Frame-Options).
- [ ] Rate limit en login.
- [ ] Índices para reservas y pedidos.
- [ ] Constraints básicos de stock/precio/total.
- [ ] README/runbook real.
- [ ] E2E de los flujos críticos.
- [ ] Registrar `createdBy`/`updatedAt` en entidades maestras.

---

## 9. Modelo de datos propuesto

### 9.1 Organización y seguridad

| Tabla | Campos clave |
|---|---|
| `Sucursal` | id, nombre, direccion, zonaHoraria, moneda, activo |
| `UsuarioApp` | id, sasiSub, nombre, email, activo |
| `Rol` | id, nombre, descripcion, activo |
| `Permiso` | id, codigo, descripcion |
| `RolPermiso` | rolId, permisoId |
| `UsuarioRol` | usuarioId, rolId, sucursalId |
| `SesionUsuario` | id, usuarioId, tokenHash, expiraEn, revocadaEn, ip, userAgent |
| `IntentoLogin` | id, usuario, ip, exito, fecha |
| `Auditoria` | id, actorId, accion, entidad, entidadId, antes, despues, motivo, ip, fecha |

### 9.2 Caja y cobros

| Tabla | Campos clave |
|---|---|
| `TurnoCaja` | id, sucursalId, cajeroId, abiertoEn, cerradoEn, fondoInicial, esperado, contado, diferencia, estado |
| `Pago` | id, pedidoId, turnoId, monto, metodo, propina, descuento, referencia, estado, cajeroId, fecha |
| `PagoDetalle` | id, pagoId, tipo, monto, metadata |
| `Descuento` | id, pedidoId, tipo, valor, motivo, autorizadoPor, fecha |
| `Comprobante` | id, pedidoId, tipo, serie, numero, estado, xml, pdf, fecha |

### 9.3 Inventario

| Tabla | Campos clave |
|---|---|
| `Insumo` | id, nombre, unidad, stockActual, stockMinimo, costoUnitario, activo |
| `Receta` | id, productoId, rendimiento, activo |
| `RecetaDetalle` | recetaId, insumoId, cantidad, unidad |
| `MovimientoStock` | id, insumoId, tipo, cantidad, costo, motivo, referencia, usuarioId, fecha |
| `Proveedor` | id, nombre, contacto, telefono, email, activo |
| `Compra` | id, proveedorId, estado, fecha, total |
| `CompraDetalle` | compraId, insumoId, cantidad, costoUnitario |
| `Merma` | id, insumoId, cantidad, motivo, usuarioId, fecha |
| `ConteoInventario` | id, sucursalId, estado, fecha |
| `ConteoDetalle` | conteoId, insumoId, esperado, contado, diferencia |

### 9.4 Menú y pedidos

| Tabla | Campos clave |
|---|---|
| `Modificador` | id, nombre, precio, activo |
| `GrupoModificador` | id, nombre, min, max, obligatorio |
| `ProductoModificador` | productoId, grupoId |
| `Variante` | id, productoId, nombre, precio |
| `Combo` | id, nombre, precio, activo |
| `ComboDetalle` | comboId, productoId, cantidad |
| `Impuesto` | id, nombre, tasa, incluido |
| `PrecioHistorico` | productoId, precio, vigenteDesde, usuarioId |
| `DisponibilidadHorario` | productoId, dia, horaInicio, horaFin |

### 9.5 Clientes y canales

| Tabla | Campos clave |
|---|---|
| `Cliente` | id, nombre, telefono, email, preferencias, consentimiento |
| `Direccion` | id, clienteId, etiqueta, direccion, referencia |
| `PedidoCanal` | enum: Salon, Takeout, Delivery, QR |
| `Delivery` | id, pedidoId, direccionId, repartidorId, estado, entregadoEn |
| `ReservaSlot` | mesaId, inicio, fin, capacidad |
| `ListaEspera` | id, clienteNombre, telefono, personas, estado, fecha |
| `Feedback` | id, pedidoId, clienteId, puntuacion, comentario, fecha |
| `PuntosLealtad` | clienteId, puntos, actualizadoEn |
| `Cupon` | id, codigo, tipo, valor, vigencia, activo |

### 9.6 Extensiones a tablas actuales

**`Pedido`**
- `sucursalId`, `clienteId`, `canal`.
- `subtotal`, `impuesto`, `descuento`, `propina`, `total`.
- `mesaId` nullable para takeout/delivery.
- `notas`.
- Estado ampliado.

**`PedidoDetalle`**
- `notas`.
- `modificadores` (relación o JSON).
- Estado ampliado.
- `cancelado`, `motivoCancelacion`, `autorizadoPor`.
- `enviadoCocinaEn`, `listoEn`, `servidoEn`.
- `precioCosto` para margen real.

**`Producto`**
- `costo`, `tiempoPreparacion`, `alergenos`.
- `disponible`, `sku`.
- Relación con receta y modificadores.

---

## 10. Requisitos no funcionales

### 10.1 Seguridad

- Validación de entrada con Zod en todas las APIs.
- Autorización por permiso en cada endpoint.
- Rate limit en login, admin y endpoints sensibles.
- Sesión revocable y rotación.
- MFA para roles administrativos.
- Headers de seguridad.
- CSRF explícito para mutaciones.
- Secretos fuera del repositorio.
- Escaneo de dependencias.
- Auditoría de accesos y cambios.

### 10.2 Confiabilidad

- Backups automáticos y restore probado.
- Migraciones versionadas y revisadas.
- Health check y readiness.
- Idempotencia en pagos, devoluciones y anulaciones.
- Transacciones y constraints en operaciones críticas.
- Cola offline con resolución de conflictos.
- Rate limit distribuido (Redis/Upstash) si hay más de una instancia.

### 10.3 Observabilidad

- Logs estructurados con correlation id.
- Sentry/APM para errores y rendimiento.
- Métricas de negocio: ventas, ticket, tiempos de cocina, mermas, diferencias de caja.
- Alertas de stock bajo, caja descuadrada, pedidos demorados y errores 5xx.

### 10.4 Calidad

- E2E con Playwright para flujos críticos.
- Pruebas de concurrencia para stock, pagos y reservas.
- Pruebas de accesibilidad automatizadas (axe).
- Pruebas de carga para horas pico.
- Contract tests de APIs.
- CI/CD con migraciones y despliegue a staging.

### 10.5 Documentación

- README real con arquitectura, variables de entorno y despliegue.
- Runbook de incidentes y restore.
- Documentación de API.
- Guía de roles y permisos.
- Seed/demo para nuevos entornos.

---

## 11. Decisiones pendientes

1. ¿Emiten **boleta/factura electrónica (SUNAT)** o solo ticket interno?
   - Si es obligatorio, fiscal sube a P0.
2. ¿Una sola sede o **varias sucursales**?
   - Multi-sucursal cambia el modelo de datos desde el inicio.
3. ¿Habrá **delivery/takeout** o solo salón?
   - Define canales, direcciones, repartidor y logística.
4. ¿El inventario debe ser por **insumos y recetas** o basta stock por producto terminado?
   - Define la profundidad de la Fase 5.
5. ¿Seguimos con **SASI como login** o quieren usuarios/roles locales?
   - Define la estrategia de identidad y revocación.
6. ¿Cuál es la prioridad del próximo bloque: **caja/cobros**, **inventario**, o **permisos/auditoría**?
   - Define el orden de la Fase 4.

---

## 12. Recomendación de arranque

Empezar por **Fase 4: Caja + auditoría + permisos + validaciones**.

Es lo que más impacto tiene en confianza operativa:

- Permite cobrar de forma profesional y cuadrar caja.
- Habilita delegar roles sin dar acceso total.
- Deja trazabilidad de cada cambio sensible.
- Es prerrequisito para inventario con costos reales, reportes financieros y facturación.
- Reduce el riesgo de fraude, errores y pérdida de datos.

Si el negocio emite comprobantes fiscales, integrar SUNAT dentro de la misma fase.

Después avanzar con **Fase 5: Inventario y menú**, y finalmente **Fase 6: Crecimiento**.
