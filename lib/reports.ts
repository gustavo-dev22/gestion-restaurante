import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPeruHour } from "@/lib/utils";
import { CACHE_REVALIDATE_SECONDS, CACHE_TAGS } from "@/lib/cache-config";

const PAGE_SIZE = 10;

function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

// ---------- Horas pico ----------
export interface HoraPicoItem {
  hora: string;
  cantidad: number;
  montoTotal: number;
}

export interface HorasPicoReport {
  ventasPorHora: HoraPicoItem[];
  resumen: { horaMasFrecuente: string; maxPedidos: number };
}

export async function getHorasPicoReport(): Promise<HorasPicoReport> {
  const pedidos = await prisma.pedido.findMany({
    where: { estado: { not: "ANULADO" } },
    select: { fecha_creacion: true, total: true },
  });

  const ventasPorHora: HoraPicoItem[] = Array.from({ length: 24 }, (_, index) => ({
    hora: `${index}:00`,
    cantidad: 0,
    montoTotal: 0,
  }));

  for (const pedido of pedidos) {
    if (!pedido.fecha_creacion) continue;
    const hora = getPeruHour(pedido.fecha_creacion);
    if (hora < 0 || hora > 23) continue;
    ventasPorHora[hora].cantidad += 1;
    ventasPorHora[hora].montoTotal += Number(pedido.total ?? 0);
  }

  const horaPico = [...ventasPorHora].sort((a, b) => b.cantidad - a.cantidad)[0];

  return {
    ventasPorHora,
    resumen: {
      horaMasFrecuente: horaPico?.hora ?? "0:00",
      maxPedidos: horaPico?.cantidad ?? 0,
    },
  };
}

// ---------- Ingeniería de menú ----------
export type IngenieriaClasificacion =
  | "ESTRELLA"
  | "CABALLO"
  | "ROMPECABEZAS"
  | "PERRO"
  | "SIN_COSTO"
  | "SIN_VENTAS";

export interface IngenieriaItem {
  id: number;
  nombre: string;
  cantidad: number;
  ingreso: number;
  costo: number | null;
  margenUnitario: number | null;
  margenTotal: number | null;
  margen: string;
  mix: number;
  clasificacion: IngenieriaClasificacion;
}

export interface IngenieriaReport {
  matriz: IngenieriaItem[];
  promedioVentas: string;
  conteos: Record<string, number>;
  totalUnidades: number;
  totalIngreso: number;
  totalCosto: number;
  totalMargen: number;
  costoCompleto: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export async function getIngenieriaReport(page = 1): Promise<IngenieriaReport> {
  const [detalles, productos] = await Promise.all([
    prisma.pedidoDetalle.findMany({
      where: { pedido: { estado: { in: ["PAGADO", "CERRADO"] } } },
      select: {
        productoId: true,
        cantidad: true,
        precio_unitario: true,
        costoTotal: true,
      },
    }),
    prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, precio: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const acumulado = new Map<
    number,
    { cantidad: number; ingreso: number; costo: number; costoConocido: boolean; costoCompleto: boolean }
  >();

  for (const detalle of detalles) {
    const actual = acumulado.get(detalle.productoId) ?? {
      cantidad: 0,
      ingreso: 0,
      costo: 0,
      costoConocido: false,
      costoCompleto: true,
    };
    actual.cantidad += detalle.cantidad;
    actual.ingreso += Number(detalle.precio_unitario) * detalle.cantidad;
    if (detalle.costoTotal === null) {
      actual.costoCompleto = false;
    } else {
      actual.costo += Number(detalle.costoTotal);
      actual.costoConocido = true;
    }
    acumulado.set(detalle.productoId, actual);
  }

  const totalUnidades = Array.from(acumulado.values()).reduce(
    (total, item) => total + item.cantidad,
    0
  );
  const conCosto = Array.from(acumulado.entries())
    .filter(([, item]) => item.cantidad > 0 && item.costoCompleto)
    .map(([productoId, item]) => ({
      productoId,
      cantidad: item.cantidad,
      margenUnitario: (item.ingreso - item.costo) / item.cantidad,
    }));
  const medianaPopularidad = median(conCosto.map((item) => item.cantidad));
  const medianaMargen = median(conCosto.map((item) => item.margenUnitario));

  let totalIngreso = 0;
  let totalCosto = 0;
  let costoCompleto = true;

  const matrizCompleta: IngenieriaItem[] = productos.map((producto) => {
    const item = acumulado.get(producto.id);
    const cantidad = item?.cantidad ?? 0;
    const ingreso = item?.ingreso ?? 0;
    const costo = item?.costoConocido ? item.costo : null;
    const margenUnitario =
      item?.costoCompleto && costo !== null && cantidad > 0
        ? (ingreso - costo) / cantidad
        : null;
    const margenTotal = item?.costoCompleto && costo !== null ? ingreso - costo : null;
    const mix = totalUnidades > 0 ? cantidad / totalUnidades : 0;

    totalIngreso += ingreso;
    if (item?.costoConocido) totalCosto += item.costo;
    if (cantidad > 0 && !item?.costoCompleto) costoCompleto = false;

    let clasificacion: IngenieriaClasificacion;
    if (cantidad === 0) {
      clasificacion = "SIN_VENTAS";
    } else if (!item?.costoCompleto || costo === null || margenUnitario === null) {
      clasificacion = "SIN_COSTO";
    } else {
      const popular = cantidad >= medianaPopularidad;
      const rentable = margenUnitario >= medianaMargen;
      clasificacion = popular
        ? rentable
          ? "ESTRELLA"
          : "CABALLO"
        : rentable
          ? "ROMPECABEZAS"
          : "PERRO";
    }

    return {
      id: producto.id,
      nombre: producto.nombre,
      cantidad,
      ingreso: Math.round(ingreso * 100) / 100,
      costo: costo === null ? null : Math.round(costo * 100) / 100,
      margenUnitario:
        margenUnitario === null ? null : Math.round(margenUnitario * 100) / 100,
      margenTotal: margenTotal === null ? null : Math.round(margenTotal * 100) / 100,
      margen:
        margenUnitario === null
          ? "Sin costo real"
          : margenUnitario.toFixed(2),
      mix,
      clasificacion,
    };
  });

  const conteos = matrizCompleta.reduce<Record<string, number>>((acc, item) => {
    acc[item.clasificacion] = (acc[item.clasificacion] ?? 0) + 1;
    return acc;
  }, {});

  const { items, total, page: current, pageSize, totalPages } = paginate(
    matrizCompleta,
    page
  );

  return {
    matriz: items,
    promedioVentas:
      productos.length > 0 ? (totalUnidades / productos.length).toFixed(2) : "0.00",
    conteos,
    totalUnidades,
    totalIngreso: Math.round(totalIngreso * 100) / 100,
    totalCosto: Math.round(totalCosto * 100) / 100,
    totalMargen: Math.round((totalIngreso - totalCosto) * 100) / 100,
    costoCompleto,
    total,
    page: current,
    pageSize,
    totalPages,
  };
}
// ---------- Inventario ----------
export interface InsumoCritico {
  id: number;
  nombre: string;
  unidad: string;
  stockTotal: number;
  stockMinimo: number;
  puntoRecompra: number;
  costoPromedio: number;
  valor: number;
  almacenes: Array<{ nombre: string; cantidad: number }>;
}

export interface InventarioReport {
  critico: InsumoCritico[];
  resumen: { totalInsumosCriticos: number; valorizacionBodega: string };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInventarioReport(page = 1): Promise<InventarioReport> {
  const insumos = await prisma.insumo.findMany({
    where: { activo: true },
    include: {
      unidadBase: true,
      stocks: { include: { almacen: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const mapa = insumos.map((insumo) => {
    const stockTotal = insumo.stocks.reduce(
      (total, stock) => total + Number(stock.cantidad),
      0
    );
    const bajo =
      (Number(insumo.stockMinimo) > 0 && stockTotal <= Number(insumo.stockMinimo)) ||
      (Number(insumo.puntoRecompra) > 0 && stockTotal <= Number(insumo.puntoRecompra));
    return {
      id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidadBase.codigo,
      stockTotal,
      stockMinimo: Number(insumo.stockMinimo),
      puntoRecompra: Number(insumo.puntoRecompra),
      costoPromedio: Number(insumo.costoPromedio),
      valor: stockTotal * Number(insumo.costoPromedio),
      almacenes: insumo.stocks.map((stock) => ({
        nombre: stock.almacen.nombre,
        cantidad: Number(stock.cantidad),
      })),
      bajo,
    };
  });

  const criticoCompleto = mapa
    .filter((insumo) => insumo.bajo)
    .sort((a, b) => a.stockTotal - b.stockTotal);
  const valorizacion = mapa.reduce((total, insumo) => total + insumo.valor, 0);
  const { items, total, page: current, pageSize, totalPages } = paginate(
    criticoCompleto,
    page
  );

  return {
    critico: items.map((insumo) => ({
      id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      stockTotal: insumo.stockTotal,
      stockMinimo: insumo.stockMinimo,
      puntoRecompra: insumo.puntoRecompra,
      costoPromedio: insumo.costoPromedio,
      valor: insumo.valor,
      almacenes: insumo.almacenes,
    })),
    resumen: {
      totalInsumosCriticos: criticoCompleto.length,
      valorizacionBodega: valorizacion.toFixed(2),
    },
    total,
    page: current,
    pageSize,
    totalPages,
  };
}
// ---------- DesempeÃ±o del personal ----------
export interface PersonalRankingItem {
  id: string;
  mesero: string;
  total: number;
  pedidos: number;
  ticketPromedio: string;
}

export interface PersonalReport {
  ranking: PersonalRankingItem[];
  mejor: PersonalRankingItem | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPersonalReport(page = 1): Promise<PersonalReport> {
  const estadisticas = await prisma.pedido.groupBy({
    by: ["usuarioId", "nombreMesero"],
    _sum: { total: true },
    _count: { id: true },
    where: { estado: { in: ["PAGADO", "CERRADO"] }, NOT: { usuarioId: null } },
  });

  const rankingCompleto = estadisticas
    .map((item) => {
      const total = Number(item._sum.total ?? 0);
      const pedidos = item._count.id ?? 0;
      return {
        id: String(item.usuarioId ?? ""),
        mesero: item.nombreMesero ?? "Sin nombre",
        total,
        pedidos,
        ticketPromedio: pedidos > 0 ? (total / pedidos).toFixed(2) : "0.00",
      };
    })
    .sort((a, b) => b.total - a.total);

  const { items, total, page: current, pageSize, totalPages } = paginate(
    rankingCompleto,
    page
  );

  return {
    ranking: items,
    mejor: rankingCompleto[0] ?? null,
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

// ---------- Dashboard ----------
export interface DashboardStats {
  categorias: number;
  productos: number;
  stockBajo: number;
  mesasTotal: number;
  mesasLibres: number;
  mesasOcupadas: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [categorias, productos, stockBajo, mesas] = await Promise.all([
    prisma.categoria.count({ where: { activo: true } }),
    prisma.producto.count({ where: { activo: true } }),
    prisma.producto.count({ where: { activo: true, stock: { lt: 10 } } }),
    prisma.mesa.findMany({ where: { activo: true }, select: { estado: true } }),
  ]);

  return {
    categorias,
    productos,
    stockBajo,
    mesasTotal: mesas.length,
    mesasLibres: mesas.filter((mesa) => mesa.estado === "Libre").length,
    mesasOcupadas: mesas.filter((mesa) => mesa.estado === "Ocupada").length,
  };
}

// ---------- Cache wrappers (preparados para use cache/cacheLife) ----------
const cacheOptions = {
  revalidate: CACHE_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.reports],
};

export const getHorasPicoReportCached = unstable_cache(
  getHorasPicoReport,
  ["reporte-horas-pico"],
  cacheOptions
);

export const getIngenieriaReportCached = unstable_cache(
  getIngenieriaReport,
  ["reporte-ingenieria"],
  cacheOptions
);

export const getInventarioReportCached = unstable_cache(
  getInventarioReport,
  ["reporte-inventario"],
  cacheOptions
);

export const getPersonalReportCached = unstable_cache(
  getPersonalReport,
  ["reporte-personal"],
  cacheOptions
);

export const getDashboardStatsCached = unstable_cache(getDashboardStats, ["dashboard-stats"], {
  revalidate: CACHE_REVALIDATE_SECONDS,
  tags: [CACHE_TAGS.dashboard, CACHE_TAGS.reports],
});
