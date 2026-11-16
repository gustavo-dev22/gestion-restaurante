/**
 * Smoke test E2E (API + base de datos) para los flujos críticos.
 *
 * Requisitos:
 *  - Servidor corriendo en SMOKE_BASE_URL (por defecto http://localhost:4206).
 *  - Variables AUTH_SECRET y DATABASE_URL disponibles (.env / .env.local).
 *
 * Uso: npm run smoke
 */

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^"|"$/g, "");
  }
}

loadEnv(".env");
loadEnv(".env.local");

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:4206";
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";
const MESERO_ID = "00000000-0000-0000-0000-000000000002";

if (!process.env.AUTH_SECRET) {
  console.error("Falta AUTH_SECRET en el entorno.");
  process.exit(1);
}

const encoder = new TextEncoder();
const b64 = (value) => Buffer.from(value).toString("base64url");

async function createToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 3600 };
  const header = b64(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64(encoder.encode(JSON.stringify(full)));
  const unsigned = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));
  return `${unsigned}.${b64(new Uint8Array(signature))}`;
}

async function api(path, { method = "GET", body, token, idempotencyKey } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Cookie: `gr_session=${token}` } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

const prisma = new PrismaClient();
const results = [];
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    results.push(`PASS  ${name}`);
  } else {
    failed += 1;
    results.push(`FAIL  ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function main() {
  const adminToken = await createToken({
    sub: ADMIN_ID,
    nombre: "Smoke Admin",
    rol: "Administrador",
    home: "/admin/dashboard",
    sections: ["admin", "mesero", "cocina", "caja"],
    cashPermissions: {
      "/caja": ["LISTAR", "CREAR", "EDITAR", "EXPORTAR"],
      "/caja/movimientos": ["LISTAR", "CREAR"],
      "/caja/historial": ["LISTAR", "EXPORTAR"],
    },
  });
  const meseroToken = await createToken({
    sub: MESERO_ID,
    nombre: "Smoke Mesero",
    rol: "Mesero",
    home: "/mesero/salon",
    sections: ["mesero"],
  });
  const cajaSinPermisosToken = await createToken({
    sub: ADMIN_ID,
    nombre: "Smoke Caja Sin Permisos",
    rol: "Cajero",
    home: "/caja",
    sections: ["caja"],
  });

  let mesaId = null;
  let productoId = null;
  let pedidoId = null;
  let llamadoId = null;
  let turnoId = null;
  let pagoId = null;
  let stockRestore = null;

  try {
    // 1) Público y sesión
    check("GET /login responde 200", (await api("/login")).status === 200);
    const publicMesas = await api("/api/public/mesas");
    check("GET /api/public/mesas responde 200", publicMesas.status === 200);
    check("API admin sin sesión responde 401", (await api("/api/admin/ventas")).status === 401);

    // 2) RBAC
    check(
      "Mesero accede a /api/mesero/llamados",
      (await api("/api/mesero/llamados", { token: meseroToken })).status === 200
    );
    check(
      "Mesero bloqueado en /api/admin/ventas (403)",
      (await api("/api/admin/ventas", { token: meseroToken })).status === 403
    );
    check(
      "Admin accede a /api/admin/ventas",
      (await api("/api/admin/ventas", { token: adminToken })).status === 200
    );
    check(
      "Caja sin acciones SASI responde 403",
      (await api("/api/caja/turno-activo", { token: cajaSinPermisosToken })).status === 403
    );

    // 3) Caja y turnos
    const turnoActivo = await api("/api/caja/turno-activo", { token: adminToken });
    if (turnoActivo.status === 200 && turnoActivo.data) {
      throw new Error(
        "Hay una caja abierta. Cierra el turno antes de ejecutar el smoke de caja."
      );
    }

    const abrirCaja = await api("/api/caja/turnos", {
      method: "POST",
      token: adminToken,
      body: { fondoInicial: 100 },
    });
    turnoId = abrirCaja.data?.turno?.id ?? null;
    check(
      "Caja abierta (200)",
      abrirCaja.status === 200 && Boolean(turnoId),
      `status=${abrirCaja.status}`
    );

    const movimiento = await api(`/api/caja/turnos/${turnoId}/movimientos`, {
      method: "POST",
      token: adminToken,
      body: { tipo: "Gasto", monto: 10, motivo: "Gasto de prueba smoke" },
    });
    check("Movimiento de caja registrado (200)", movimiento.status === 200);

    // 4) Stock insuficiente
    const productos = (await api("/api/public/productos")).data ?? [];
    const producto = productos.find((item) => Number(item.stock) >= 3);
    check("Existe un producto con stock >= 3 para probar", Boolean(producto));
    const mesasLibres = (publicMesas.data ?? []).filter((mesa) => mesa.estado === "Libre");
    check("Existe una mesa libre para probar", mesasLibres.length > 0);

    if (!producto || mesasLibres.length === 0) {
      throw new Error("No hay datos suficientes (mesa libre / producto con stock).");
    }

    mesaId = mesasLibres[0].id;
    productoId = producto.id;
    const stockInicial = Number(producto.stock);
    stockRestore = stockInicial;

    const stockFail = await api("/api/public/pedido", {
      method: "POST",
      body: { mesaId, items: [{ id: productoId, cantidad: stockInicial + 1 }] },
    });
    const mesaTrasFallo = await prisma.mesa.findUnique({ where: { id: mesaId } });
    const productoTrasFallo = await prisma.producto.findUnique({ where: { id: productoId } });
    check("Stock insuficiente devuelve 409", stockFail.status === 409, `status=${stockFail.status}`);
    check("Stock insuficiente libera/la mesa sigue libre", mesaTrasFallo?.estado === "Libre");
    check(
      "Stock insuficiente no descuenta inventario",
      Number(productoTrasFallo?.stock) === stockInicial
    );

    // 4) Flujo QR -> cocina -> llamada -> pago
    const creado = await api("/api/public/pedido", {
      method: "POST",
      body: { mesaId, items: [{ id: productoId, cantidad: 1 }] },
    });
    pedidoId = creado.data?.id ?? null;
    check("Pedido QR creado (200)", creado.status === 200 && Boolean(pedidoId));

    const confirmado = await api("/api/mesero/confirmar", {
      method: "PATCH",
      token: adminToken,
      body: { pedidoId },
    });
    check("Pedido confirmado (Pendiente)", confirmado.status === 200 && confirmado.data?.estado === "Pendiente");

    // 4.1) Idempotencia de comanda: el mismo key no debe duplicar stock ni cantidades
    const claveIdempotencia = `smoke-${Date.now()}`;
    const comandaPayload = { pedidoId, items: [{ id: productoId, cantidad: 1 }] };
    const stockAntesComanda = Number(
      (await prisma.producto.findUnique({ where: { id: productoId } }))?.stock ?? 0
    );

    const comanda1 = await api("/api/mesero/pedido/detalle", {
      method: "POST",
      token: adminToken,
      body: comandaPayload,
      idempotencyKey: claveIdempotencia,
    });
    const comanda2 = await api("/api/mesero/pedido/detalle", {
      method: "POST",
      token: adminToken,
      body: comandaPayload,
      idempotencyKey: claveIdempotencia,
    });

    const stockTrasComandas = Number(
      (await prisma.producto.findUnique({ where: { id: productoId } }))?.stock ?? 0
    );
    const detalleProducto = await prisma.pedidoDetalle.findFirst({
      where: { pedidoId, productoId },
    });

    check(
      "Idempotencia: misma clave no duplica stock ni cantidades",
      comanda1.status === 200 &&
        comanda2.status === 200 &&
        JSON.stringify(comanda1.data) === JSON.stringify(comanda2.data) &&
        stockTrasComandas === stockAntesComanda - 1 &&
        detalleProducto?.cantidad === 2,
      `stock=${stockAntesComanda}->${stockTrasComandas}, cantidad=${detalleProducto?.cantidad}`
    );

    const detalle = await prisma.pedidoDetalle.findMany({
      where: { pedidoId },
      include: { producto: { include: { categoria: true } } },
    });
    const area = detalle[0]?.producto.categoria.area ?? "Cocina";
    const comandas = await api(`/api/cocina/comandas?area=${encodeURIComponent(area)}`, {
      token: adminToken,
    });
    const propias = (comandas.data ?? []).filter((item) => item.pedidoId === pedidoId);
    check("Pedido QR visible en cocina", propias.length === detalle.length && detalle.length > 0);

    for (const item of propias) {
      await api("/api/cocina/comandas", {
        method: "PATCH",
        token: adminToken,
        body: { detalleId: item.id, nuevoEstado: "Listo" },
      });
    }

    const llamado = await api("/api/public/llamar-mesero", {
      method: "POST",
      body: { mesaId },
    });
    llamadoId = llamado.data?.solicitudId ?? null;
    check("Llamado a mesero creado", llamado.status === 200 && Boolean(llamadoId));

    const atencion = await api("/api/mesero/llamados", {
      method: "PATCH",
      token: adminToken,
      body: { pedidoId: llamadoId },
    });
    check("Llamado atendido", atencion.status === 200 && atencion.data?.estado === "Atendido");

    const pago = await api("/api/mesero/pedido/pagar", {
      method: "PATCH",
      token: adminToken,
      body: { pedidoId, metodoPago: "Tarjeta" },
    });
    pagoId = pago.data?.pagoId ?? null;
    check("Pago procesado (200)", pago.status === 200 && Boolean(pagoId));

    const pedidoFinal = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    check("Pedido queda Pagado", pedidoFinal?.estado === "Pagado");
    check("Método de pago persistido", pedidoFinal?.metodoPago === "Tarjeta");
    const mesaFinal = await prisma.mesa.findUnique({ where: { id: mesaId } });
    check("Mesa liberada tras el pago", mesaFinal?.estado === "Libre");

    const cierrePendiente = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: adminToken,
      body: { efectivoContado: 90 },
    });
    check(
      "Cierre bloqueado con pago electrónico pendiente (409)",
      cierrePendiente.status === 409 &&
        cierrePendiente.data?.error === "PAGOS_PENDIENTES"
    );

    const conciliado = await api(`/api/caja/turnos/${turnoId}/conciliar`, {
      method: "PATCH",
      token: adminToken,
      body: { pagoIds: [pagoId] },
    });
    check(
      "Pago electrónico conciliado (200)",
      conciliado.status === 200 && conciliado.data?.conciliados === 1
    );

    const cierre = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: adminToken,
      body: { efectivoContado: 90 },
    });
    check(
      "Cierre de caja correcto (200)",
      cierre.status === 200 &&
        cierre.data?.turno?.estado === "Cerrado" &&
        Number(cierre.data?.turno?.diferencia) === 0
    );

    const reporte = await api(`/api/caja/turnos/${turnoId}/reporte`, {
      token: adminToken,
    });
    check(
      "Reporte de cierre disponible (200)",
      reporte.status === 200 &&
        reporte.data?.turno?.estado === "Cerrado" &&
        reporte.data?.pagos?.length === 1 &&
        Number(reporte.data?.resumen?.totalTarjeta) > 0
    );

    // 5) Disponibilidad de reservas
    const fecha = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    const disponibilidad = await api(
      `/api/public/reservas?mesaId=${mesaId}&fecha=${encodeURIComponent(fecha)}`
    );
    check(
      "Consulta de disponibilidad responde 200",
      disponibilidad.status === 200 && typeof disponibilidad.data?.disponible === "boolean"
    );
  } finally {
    if (pedidoId) {
      await prisma.pago.deleteMany({ where: { pedidoId } }).catch(() => {});
    }
    if (llamadoId) {
      await prisma.pedido.delete({ where: { id: llamadoId } }).catch(() => {});
    }
    if (pedidoId) {
      await prisma.pedidoDetalle.deleteMany({ where: { pedidoId } });
      await prisma.pedido.delete({ where: { id: pedidoId } }).catch(() => {});
    }
    if (turnoId) {
      await prisma.pago.deleteMany({ where: { turnoId } }).catch(() => {});
      await prisma.movimientoCaja.deleteMany({ where: { turnoId } }).catch(() => {});
      await prisma.cajaEvento.deleteMany({ where: { turnoId } }).catch(() => {});
      await prisma.turnoCaja.delete({ where: { id: turnoId } }).catch(() => {});
    }
    if (productoId && stockRestore !== null) {
      await prisma.producto
        .update({ where: { id: productoId }, data: { stock: stockRestore } })
        .catch(() => {});
    }
    if (mesaId) {
      await prisma.mesa.update({ where: { id: mesaId }, data: { estado: "Libre" } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log(`\nSmoke test (${BASE_URL})\n${results.join("\n")}`);
    console.log(`\nResultado: ${results.length - failed} OK, ${failed} fallidos.`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\nSmoke test interrumpido:", error);
    process.exit(1);
  });
