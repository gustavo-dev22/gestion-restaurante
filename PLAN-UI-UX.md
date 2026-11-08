# Auditoría y Plan de Mejoras UI/UX — Gestión Restaurante

> Documento de trabajo. Audita las 21 pantallas, componentes y estilos del proyecto y define el plan de remediación por fases.
> Estado: **aprobado, pendiente de ejecución**.

---

## Resumen ejecutivo

La aplicación es funcional y tiene buen dominio del negocio, pero presenta **inconsistencia de sistema de diseño, problemas serios de responsive/tablet, accesibilidad baja y estados de carga/error frágiles**.

**Puntaje global: ~4.8/10** (funcional, pero no listo para producción ni para uso intensivo en tablets).

### Puntaje por dimensión

| Dimensión | Nota | Comentario |
|---|---|---|
| Consistencia visual | 5/10 | 3 lenguajes visuales distintos conviven |
| Responsive (móvil/tablet) | 3/10 | Sidebar fijo y layouts de ancho fijo rompen en tablet |
| Navegación / IA | 5/10 | Menú dinámico, pero sin estado activo ni aterrizaje por rol |
| Accesibilidad (a11y) | 2/10 | 0 `aria-*`, divs clickeables, sin foco visible, texto de 8-10px |
| Formularios / feedback | 5/10 | Todo en SweetAlert, sin validación inline |
| Estados carga/vacío/error | 4/10 | Inconsistentes y varios flujos crashean si falla la API |
| UX de flujos por rol | 6/10 | Mesero/cocina bien pensados, cliente digital incompleto |
| Rendimiento percibido | 4/10 | `import * as Icons`, polling con pantalla completa en blanco |

---

## Decisiones de producto

- Dispositivos objetivo: **tablet (meseros/cocina), desktop (admin) y móvil (clientes)**.
- Formularios: **migrar de SweetAlert2 a modales propios** accesibles y responsivos.

---

## Hallazgos

### 1. Críticos (bloquean uso real)

1. **Sidebar no responsive.** `w-72` fijo, sin hamburguesa ni overlay. En tablet/móvil consume 288px y aplasta el contenido. `components/sidebar.tsx:41`, `app/(dashboard)/layout.tsx:38-44`. No existe ningún `md:hidden`/`hidden md:` en todo el proyecto.
2. **Toma de pedido inusable en tablet.** Layout `h-[calc(100vh-80px)]` + carrito fijo `w-96` (`app/(dashboard)/mesero/pedido/[id]/page.tsx:178,255`). No colapsa a una columna.
3. **Acciones ocultas solo en hover.** Editar/eliminar mesa aparece con `opacity-0 group-hover:opacity-100` (`app/(dashboard)/admin/mesas/page.tsx:249`). En tablet no hay hover: no se puede editar ni eliminar mesas.
4. **Pantalla de cocina parpadea cada 30s.** `fetchComandas` pone `loading=true` y el render retorna spinner a pantalla completa (`app/(dashboard)/cocina/comandas/page.tsx:14,102`), disparado por `setInterval(...,30000)` (línea 34).
5. **QR probablemente crashea en SSR.** `window.location.origin` evaluado en render (`app/(dashboard)/admin/mesas/qrs/page.tsx:52`) sin guard de cliente.
6. **Riesgo de crash por API sin manejo.** Reportes acceden `data.resumen`, `ranking[0]`, `reporte.matriz` sin validar (`app/(dashboard)/admin/reportes/horas-pico/page.tsx:14`, `ingenieria:32`, `inventario:14`, `personal:14`). Si la API falla, pantalla en blanco.

### 2. Altos

**Responsive / layout**
- Tablas sin `overflow-x-auto` (solo mesas lo tiene): categorías (`admin/categorias/page.tsx:256`), productos (`:258`), ventas (`admin/ventas/page.tsx:83`), reportes. Se desbordan en móvil.
- Doble padding: `main p-8` + cada página `p-6/p-8`. Espacio desperdiciado e inconsistente.
- Cocina usa `min-h-screen` dentro de `main` con padding; el monitor oscuro queda enmarcado en gris claro con sidebar admin.

**Accesibilidad**
- 0 atributos `aria-*`/`role` en todo el proyecto; botones solo-icono (editar/eliminar/ojo) sin `aria-label`.
- Navegación con `<div onClick>` en sidebar (`components/sidebar.tsx:62-76`): no navegable por teclado ni con Enter.
- Sin `:focus-visible` en botones; solo inputs tienen ring.
- Texto de 8-10px con uppercase y tracking en reportes/QR (`horas-pico:71`, `inventario:90`, `personal:52`, `qrs:59`). Ilegible.
- `allowEscapeKey:false` + `allowOutsideClick:false` en casi todos los modales: el usuario queda atrapado sin salida por teclado.
- Labels no asociados a inputs en login (`app/login/page.tsx:80,94`) y reservar.

**Flujos**
- Tras login **siempre** va a `/dashboard` genérico (`app/login/page.tsx:57`), aunque el rol sea admin/mesero/cocina. No hay aterrizaje por rol.
- Sin guard de rutas por rol: cualquier usuario logueado puede abrir `/admin/*` por URL (el sidebar solo lo oculta).
- Cliente digital: no se puede quitar ni reducir productos del carrito (solo `agregarAlCarrito`, `app/(public)/cliente/mesa/[id]/page.tsx:54-63`); sin categorías, sin imágenes reales, sin estado del pedido posterior.
- Botón "Llamar al Mesero" es **falso**: solo muestra un Swal y no llama a ninguna API (`cliente/mesa/[id]:122-127`). UX engañosa.
- Carrito de cliente muestra `Mesa #{mesaId}` (id interno) en vez de `numeroMesa` (`:147`).
- Reservas permite **fechas pasadas** (sin `min` en `datetime-local`, `app/(public)/reservar/page.tsx:140`) y no valida capacidad vs. personas.

**Formularios**
- Todos los formularios usan SweetAlert2 con HTML interpolado sin escapar (`productos:148,160`, `categorias:148,153`, `ventas:26`, `reservar:45`). Un nombre con `"` o `<` rompe el modal (y es XSS).
- Validación solo por Swal, sin errores inline ni `aria-invalid`; `noValidate` en todos.
- Sin `autocomplete`, `inputMode` ni `name` en login/reservar.
- Imagen de producto: `<img>` crudo, `alt=""`, sin fallback de error (`productos:286`). En mesero apunta a `/placeholder.png` que **no existe** (`mesero/pedido/[id]:226`).

### 3. Medios

**Sistema de diseño**
- Fuente declarada Arial en `app/globals.css:25`, pero se cargan Geist y se define `--font-sans` sin aplicarla (`app/layout.tsx`, `globals.css:11`). La tipografía real no es la prevista.
- Tres estéticas mezcladas: admin limpio (`rounded-xl`, `text-2xl`), reportes editorial (`italic uppercase font-black`, `rounded-[3rem]`), cocina oscura. Escalas de radio y tamaño arbitrarias (`rounded-[2.5rem]`, `[2.8rem]`, `[3rem]`).
- Marca inconsistente: "Restaurante Pro" (login/sidebar) vs "Sistema de Restaurante" (`metadata`) y `description` sigue "Generated by create next app" (`app/layout.tsx:17`).
- Sin `error.tsx`, `not-found.tsx`, `loading.tsx`, ni títulos por ruta.

**Estados y feedback**
- Loading inconsistente: spinner de 40/48, texto "Analizando tráfico de red...", "Escaneando almacén...", barras de carga distintas.
- Empty states dispares: texto plano, icono, o nada (reservas, ventas, reportes).
- Toast solo en cocina/stock; resto usa `Swal.fire` bloqueante incluso para "guardado".
- `admin/dashboard` sin `catch`: si falla la API queda spinner infinito (`:13-20`).

**Navegación**
- Sidebar sin resaltado de página activa, sin breadcrumbs, sin colapsar. `Icons as any` importa toda la librería (`sidebar:4`, `categorias:4`, `productos:7`) -> bundle grande.
- QR/impresión: ocultar `svg[viewBox="0 0 40 40"]` global (`globals.css:28`) es un hack que puede ocultar iconos legítimos.

**Datos/fechas**
- `toLocaleString('es-PE', { timeZone:'UTC' })` puede mostrar hora incorrecta (ventas `:103`, reservas `:77`). `calcularTiempo` resta/suma 300 min a mano (`mesero/mis-pedidos:49-59`).
- Cocina muestra "10 min" hardcodeado (`cocina/comandas:152`): información falsa.
- Categorías tienen área `Postres` pero la cocina solo tiene pestañas Cocina/Bebidas -> platos de postres podrían no aparecer nunca.

**Rendimiento percibido**
- Polling de 10s (notificaciones) y 30s (cocina) sin indicador sutil; notificación `animate-bounce` infinita y sonido bloqueado por el navegador (`components/mesero/notificacionesMesero.tsx:55,11-14`).
- Sin `next/image`, sin skeletons, sin debounce en búsquedas.

### 4. Bajos
- `app/page.tsx` importa `Image` sin usarlo (lint).
- `sweetalert2-react-content` declarado pero no usado.
- `#00` + id en ticket (`ventas:101`) produce "#0010".
- Tema oscuro del sistema (`globals.css:15`) sin soporte real: componentes fuerzan claro -> posible flash/mismatch.
- Sin PWA/manifest para tablets de salón.
- Sin paginación/búsqueda en ventas, reservas y reportes.

---

## Plan de implementación (Fases 0-5)

Trabajo por fases con verificación al final de cada una (`npm run lint`, `npx tsc --noEmit`, revisión manual en `localhost:4206`).

### Base transversal

**Nuevos archivos**

```
lib/utils.ts                 -> cn(), formatCurrency(), formatDate(), timeAgo()
lib/http.ts                  -> fetch wrapper con manejo 401/errores
components/ui/Button.tsx
components/ui/Input.tsx / Field.tsx / Select.tsx / Textarea.tsx
components/ui/Card.tsx / Badge.tsx / PageHeader.tsx
components/ui/Modal.tsx      -> focus trap, Escape, scroll lock, responsive
components/ui/ConfirmDialog.tsx
components/ui/Toast.tsx + ToastProvider
components/ui/EmptyState.tsx / Spinner.tsx / Skeleton.tsx
components/ui/DataTable.tsx  -> wrappers con overflow-x-auto y sticky header
components/ui/StatCard.tsx
components/layout/AppShell.tsx + Sidebar (responsive) + Topbar
```

**Dependencias nuevas:** `clsx` y `tailwind-merge` (solo para `cn`). Sin librería de UI pesada; modal propio.

**Tokens en `globals.css`:** aplicar Geist, escala tipográfica mínima 12px, radios/mayúsculas, colores de estado semánticos, `focus-visible`, utilidades `no-print`, scrollbar.

### Fase 0 — Estabilidad (quick wins)

- `admin/mesas/qrs`: guard de `window` (mover URL a estado en `useEffect`).
- Reportes y `admin/dashboard`: `try/catch`, estado `error`, no acceder `resumen/matriz/ranking[0]` sin datos.
- `cocina/comandas`: refresco silencioso (no volver a spinner); timer real desde `fecha_creacion`.
- `mesero/pedido/[id]`: crear `public/placeholder.png` o fallback con icono; `alt` correcto.
- `globals.css`/`layout.tsx`: aplicar Geist, metadata y marca unificada ("Gestión Restaurante").
- Quitar `import Image` sin uso y dependencia `sweetalert2-react-content`.

### Fase 1 — AppShell responsive + design system

- **Sidebar:** colapsable con overlay en `< lg`, toggle en Topbar, `Link` en vez de `div onClick`, resaltado de ruta activa (`usePathname`), iconos por import nombrado.
- **Layout dashboard:** una sola fuente de padding; `main` sin `p-8` fijo.
- Reemplazar clases ad-hoc por `Button/Input/Card/Badge/PageHeader` en todas las páginas.
- Unificar escalas visuales (radios, espaciados, tipografía) entre admin y reportes.
- **Mesa admin:** acciones siempre visibles en touch (`opacity-100 md:opacity-0 md:group-hover:opacity-100`).
- **Toma de pedido:** 1 columna en tablet (cart como drawer inferior fijo) y 2 columnas en desktop.
- Tablas: `DataTable` con `overflow-x-auto`, header sticky, paginación reutilizable.

### Fase 2 — Accesibilidad + formularios propios

- Modal propio con focus trap, `aria-modal`, Escape y foco restaurado.
- Migrar todos los Swal-form: categorías, productos, mesas, reservas, pagos, login alertas, confirmaciones, notificaciones.
- Validación inline con `aria-invalid`/`aria-describedby`; labels asociados; `autocomplete`, `inputMode`.
- `aria-label` en todos los botones-icono; navegación por teclado; `focus-visible`.
- Subir textos de 8-10px a >=12px y asegurar contraste AA (slate-400 -> slate-600 donde aplique).
- Reemplazar HTML interpolado por componentes React (elimina XSS y rotura por comillas).
- Login: mostrar/ocultar contraseña, errores inline, `autoComplete`.

### Fase 3 — Estados, feedback y datos

- Patrón único: skeletons en carga, `EmptyState` ilustrado, `error.tsx`/`not-found.tsx`/`loading.tsx`.
- `Toast` no bloqueante para éxitos; `ConfirmDialog` para acciones destructivas.
- `lib/http.ts`: manejo 401 -> logout + redirect, errores de red con mensaje claro.
- `formatCurrency` (Intl es-PE, S/) y `formatDate` con timezone correcto; eliminar hack +/-300 de `mis-pedidos`.
- Post-login por rol y guard de rutas por rol.

### Fase 4 — Flujos por rol y cliente

- **Cliente:** carrito con quitar/reducir, agrupación por categoría, imágenes, seguimiento de estado del pedido, "Llamar mesero" con API real, encabezado con `numeroMesa`.
- **Reservas:** `min` en fecha, validación de capacidad, disponibilidad por hora.
- **Cocina:** pestañas coherentes con áreas (`Cocina/Bebidas/Postres`), sin "10 min" falso, refresh silencioso.
- **Admin:** búsqueda/paginación en ventas y reservas; detalle de venta imprimible.
- Notificaciones mesero: sin `animate-bounce` infinito, descartables, sonido tras interacción.

### Fase 5 — Rendimiento y pulido

- `next/image` en productos/cliente, imports de iconos nombrados, búsquedas con debounce.
- PWA opcional (manifest) para tablets.
- Revisión final de contraste, foco, responsive en 3 breakpoints y lint/typecheck.

---

## Verificación por fase

- `npm run lint` y `npx tsc --noEmit` sin errores.
- Prueba manual en 3 anchos (móvil 390, tablet 1024, desktop 1440) y flujos: login por rol, abrir mesa, comanda, cocina, pago, reserva, carta QR.
- Commit por fase en `master` (solo si se solicita) y push a GitHub.

## Riesgos

- Migrar SweetAlert a modales toca casi todas las páginas (más superficie de regresión); se hará fase por fase con typecheck.
- El guard de roles requiere conocer el mapeo SASI de `objetos/urls`; si falta, se dejan rutas protegidas por rol "principal".

---

## Notas de operación

- Dev server en **puerto 4206**: `npm run dev`.
- Requiere SQL Server en `localhost:1433` y la API SASI en `https://localhost:44337/SASI/api` (ver `.env.local`).
- Variables `.env`/`.env.local` no se versionan.
