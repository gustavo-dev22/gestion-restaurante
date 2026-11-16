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
const AUDITOR_ID = "00000000-0000-0000-0000-000000000003";
const SUPERVISOR_ID = "00000000-0000-0000-0000-000000000004";

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
      "/caja": ["LISTAR", "CREAR", "EDITAR", "EXPORTAR", "APROBAR"],
      "/caja/movimientos": ["LISTAR", "CREAR", "APROBAR"],
      "/caja/historial": ["LISTAR", "EXPORTAR", "APROBAR"],
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
  const auditorToken = await createToken({
    sub: AUDITOR_ID,
    nombre: "Smoke Auditor",
    rol: "Auditor",
    home: "/auditoria",
    sections: ["caja"],
  });
  const supervisorToken = await createToken({
    sub: SUPERVISOR_ID,
    nombre: "Smoke Supervisor",
    rol: "Supervisor",
    home: "/caja",
    sections: ["caja"],
  });

  let mesaId = null;
  let productoId = null;
  let pedidoId = null;
  let llamadoId = null;
  let turnoId = null;
  let pagoId = null;
  let devolucionId = null;
  let cuponCodigo = null;
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

    const auditorCierre = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: auditorToken,
      body: { efectivoContado: 0 },
    });
    check("Auditor sin caja:close recibe 403", auditorCierre.status === 403);

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

    const cuentaInicial = await api(`/api/caja/pedidos/${pedidoId}/cuenta`, {
      token: adminToken,
    });
    const saldoInicial = Number(cuentaInicial.data?.pedido?.saldo ?? 0);
    check(
      "Cuenta del pedido disponible con saldo pendiente",
      cuentaInicial.status === 200 && saldoInicial > 0
    );

    cuponCodigo = `SMOKE-${Date.now()}`;
    await prisma.cupon.create({
      data: {
        codigo: cuponCodigo,
        tipo: "Porcentaje",
        valor: 10,
        activo: true,
      },
    });

    const descuento = await api(`/api/caja/pedidos/${pedidoId}/descuentos`, {
      method: "POST",
      token: adminToken,
      body: { cuponCodigo, motivo: "Descuento de prueba smoke" },
    });
    const saldoDespuesDescuento = Number(
      descuento.data?.cuenta?.pedido?.saldo ?? 0
    );
    check(
      "Descuento con cupón aplicado (200)",
      descuento.status === 200 &&
        Number(descuento.data?.cuenta?.pedido?.descuentoTotal) > 0 &&
        saldoDespuesDescuento > 0 &&
        saldoDespuesDescuento < saldoInicial
    );

    const primerMonto = Math.round((saldoDespuesDescuento / 2) * 100) / 100;
    const primerPago = await api(`/api/caja/pedidos/${pedidoId}/pagos`, {
      method: "POST",
      token: adminToken,
      body: {
        metodoPago: "Efectivo",
        monto: primerMonto,
        propina: 5,
        montoRecibido: primerMonto + 20,
      },
    });
    const primerPagoId = primerPago.data?.pagoId ?? null;
    check(
      "Pago parcial en efectivo con propina (200)",
      primerPago.status === 200 &&
        Boolean(primerPagoId) &&
        Number(primerPago.data?.saldo) > 0
    );

    const cuentaParcial = await api(`/api/caja/pedidos/${pedidoId}/cuenta`, {
      token: adminToken,
    });
    const pagoEfectivo = (cuentaParcial.data?.pagos ?? []).find(
      (item) => item.id === primerPagoId
    );
    const saldoParcial = Number(cuentaParcial.data?.pedido?.saldo ?? 0);
    check(
      "Pago parcial actualiza saldo, propina y cambio",
      cuentaParcial.status === 200 &&
        cuentaParcial.data?.pedido?.estadoPago === "Parcial" &&
        Number(pagoEfectivo?.propina) === 5 &&
        Math.abs(Number(pagoEfectivo?.cambio ?? 0) - 15) < 0.01 &&
        saldoParcial > 0 &&
        saldoParcial < saldoDespuesDescuento
    );

    const segundoMonto = saldoParcial;
    const segundoPago = await api(`/api/caja/pedidos/${pedidoId}/pagos`, {
      method: "POST",
      token: adminToken,
      body: {
        metodoPago: "Tarjeta",
        monto: segundoMonto,
        referencia: "SMOKE-REF",
        codigoAutorizacion: "SMOKE-AUTH",
      },
    });
    pagoId = segundoPago.data?.pagoId ?? null;
    check(
      "Segundo pago con otro método completa la cuenta (200)",
      segundoPago.status === 200 &&
        Boolean(pagoId) &&
        Number(segundoPago.data?.saldo) === 0
    );

    const pedidoFinal = await prisma.pedido.findUnique({ where: { id: pedidoId } });
    check(
      "Pedido queda Pagado",
      pedidoFinal?.estado === "Pagado" && pedidoFinal?.estadoPago === "Pagado"
    );
    check("Método de pago persistido", pedidoFinal?.metodoPago === "Tarjeta");
    const mesaFinal = await prisma.mesa.findUnique({ where: { id: mesaId } });
    check("Mesa liberada tras el pago", mesaFinal?.estado === "Libre");

    const cuentaPagada = await api(`/api/caja/pedidos/${pedidoId}/cuenta`, {
      token: adminToken,
    });
    const pagosValidos = (cuentaPagada.data?.pagos ?? []).filter(
      (item) => item.estado !== "Anulado"
    );
    const totalPagos = pagosValidos.reduce(
      (total, item) => total + Number(item.monto) + Number(item.propina),
      0
    );
    check(
      "La suma de pagos coincide con el total",
      Math.abs(totalPagos - Number(pedidoFinal?.total ?? 0)) < 0.01
    );

    const ticket = await api(`/api/caja/pedidos/${pedidoId}/ticket`, {
      token: adminToken,
    });
    check(
      "Ticket interno disponible (200)",
      ticket.status === 200 && Boolean(ticket.data?.cuenta?.comprobante)
    );

    const turnoAntes = await api("/api/caja/turno-activo", { token: adminToken });
    const efectivoEsperado = Number(
      turnoAntes.data?.resumen?.efectivoEsperado ?? 0
    );

    const cierrePendiente = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: adminToken,
      body: { efectivoContado: efectivoEsperado },
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

    const detalleDevolucion = await prisma.pedidoDetalle.findFirst({
      where: { pedidoId, productoId },
    });
    if (!detalleDevolucion) {
      throw new Error("No se encontró el detalle para la devolución.");
    }
    const stockAntesDevolucion = Number(
      (await prisma.producto.findUnique({ where: { id: productoId } }))?.stock ?? 0
    );

    const devolucion = await api(`/api/caja/pedidos/${pedidoId}/devoluciones`, {
      method: "POST",
      token: adminToken,
      body: {
        pagoId,
        monto: segundoMonto,
        propina: 0,
        motivo: "Devolución de prueba smoke",
        items: [{ pedidoDetalleId: detalleDevolucion.id, cantidad: 1 }],
      },
    });
    devolucionId = devolucion.data?.cuenta?.devoluciones?.[0]?.id ?? null;
    const stockTrasDevolucion = Number(
      (await prisma.producto.findUnique({ where: { id: productoId } }))?.stock ?? 0
    );
    const pagoReembolsado = (devolucion.data?.cuenta?.pagos ?? []).find(
      (item) => item.id === pagoId
    );
    check(
      "Devolución registrada y stock repuesto (200)",
      devolucion.status === 200 &&
        Boolean(devolucionId) &&
        stockTrasDevolucion === stockAntesDevolucion + 1 &&
        pagoReembolsado?.estado === "Reembolsado"
    );

    const turnoTrasDevolucion = await api("/api/caja/turno-activo", {
      token: adminToken,
    });
    const efectivoFinal = Number(
      turnoTrasDevolucion.data?.resumen?.efectivoEsperado ?? 0
    );

    const cierreDevPendiente = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: adminToken,
      body: { efectivoContado: efectivoFinal },
    });
    check(
      "Cierre bloqueado con devolución electrónica pendiente (409)",
      cierreDevPendiente.status === 409 &&
        cierreDevPendiente.data?.error === "DEVOLUCIONES_PENDIENTES"
    );

    const conciliadoDev = await api(`/api/caja/turnos/${turnoId}/conciliar`, {
      method: "PATCH",
      token: adminToken,
      body: { devolucionIds: [devolucionId] },
    });
    check(
      "Devolución electrónica conciliada (200)",
      conciliadoDev.status === 200 &&
        conciliadoDev.data?.devolucionesConciliadas === 1
    );

    const cierre = await api(`/api/caja/turnos/${turnoId}/cerrar`, {
      method: "POST",
      token: adminToken,
      body: { efectivoContado: efectivoFinal },
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
      "Reporte de cierre con pagos, propinas, descuentos y devoluciones (200)",
      reporte.status === 200 &&
        reporte.data?.turno?.estado === "Cerrado" &&
        reporte.data?.pagos?.length === 2 &&
        reporte.data?.devoluciones?.length === 1 &&
        Number(reporte.data?.resumen?.totalTarjeta) > 0 &&
        Number(reporte.data?.turno?.totalPropinas) > 0 &&
        Number(reporte.data?.turno?.totalDescuentos) > 0 &&
        Number(reporte.data?.turno?.totalDevoluciones) > 0
    );

    const auditoria = await prisma.auditoria.count({
      where: {
        accion: {
          in: [
            "caja.open",
            "caja.movement",
            "discount.apply",
            "payment.create",
            "payment.refund",
            "payment.conciliate",
            "caja.close",
          ],
        },
      },
    });
    check("Auditoría registra las mutaciones de caja", auditoria >= 7, `filas=${auditoria}`);

    const exportAdmin = await api("/api/auditoria/export", { token: adminToken });
    check("Admin exporta auditoría (200)", exportAdmin.status === 200);

    const exportSupervisor = await api("/api/auditoria/export", {
      token: supervisorToken,
    });
    check(
      "Supervisor no exporta auditoría (403)",
      exportSupervisor.status === 403
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
    const devoluciones = pedidoId || turnoId
      ? await prisma.devolucion
          .findMany({
            where: {
              OR: [
                ...(pedidoId ? [{ pedidoId }] : []),
                ...(turnoId ? [{ turnoId }] : []),
              ],
            },
            select: { id: true },
          })
          .catch(() => [])
      : [];
    const devolucionIds = devoluciones.map((item) => item.id);

    if (devolucionIds.length > 0) {
      await prisma.devolucionDetalle
        .deleteMany({ where: { devolucionId: { in: devolucionIds } } })
        .catch(() => {});
      await prisma.movimientoStock
        .deleteMany({ where: { referenciaId: { in: devolucionIds } } })
        .catch(() => {});
      await prisma.devolucion
        .deleteMany({ where: { id: { in: devolucionIds } } })
        .catch(() => {});
    }

    const pagos = pedidoId || turnoId
      ? await prisma.pago
          .findMany({
            where: {
              OR: [
                ...(pedidoId ? [{ pedidoId }] : []),
                ...(turnoId ? [{ turnoId }] : []),
              ],
            },
            select: { id: true },
          })
          .catch(() => [])
      : [];
    const pagoIds = pagos.map((item) => item.id);

    if (pagoIds.length > 0) {
      await prisma.pagoAplicacion
        .deleteMany({ where: { pagoId: { in: pagoIds } } })
        .catch(() => {});
      await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } }).catch(() => {});
    }

    if (pedidoId) {
      await prisma.descuento.deleteMany({ where: { pedidoId } }).catch(() => {});
      await prisma.comprobante.deleteMany({ where: { pedidoId } }).catch(() => {});
      await prisma.pedidoDetalle.deleteMany({ where: { pedidoId } }).catch(() => {});
      await prisma.pedido.delete({ where: { id: pedidoId } }).catch(() => {});
    }
    if (llamadoId) {
      await prisma.pedido.delete({ where: { id: llamadoId } }).catch(() => {});
    }
    if (turnoId) {
      await prisma.movimientoCaja.deleteMany({ where: { turnoId } }).catch(() => {});
      await prisma.cajaEvento.deleteMany({ where: { turnoId } }).catch(() => {});
      await prisma.turnoCaja.delete({ where: { id: turnoId } }).catch(() => {});
    }
    if (cuponCodigo) {
      await prisma.cupon.deleteMany({ where: { codigo: cuponCodigo } }).catch(() => {});
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
