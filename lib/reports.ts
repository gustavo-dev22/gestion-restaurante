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
    where: { estado: { notIn: ["Llamado", "Atendido", "Expirado"] } },
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
export interface IngenieriaItem {
  id: number;
  nombre: string;
  cantidad: number;
  margen: string;
  clasificacion: string;
}

export interface IngenieriaReport {
  matriz: IngenieriaItem[];
  promedioVentas: string;
  conteos: Record<string, number>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getIngenieriaReport(page = 1): Promise<IngenieriaReport> {
  const ventas = await prisma.pedidoDetalle.groupBy({
    by: ["productoId"],
    where: { pedido: { estado: { notIn: ["Expirado"] } } },
    _sum: { cantidad: true },
  });

  const productos = await prisma.producto.findMany({
    select: { id: true, nombre: true, precio: true },
  });

  const totalVendido = ventas.reduce((acc, venta) => acc + (venta._sum.cantidad ?? 0), 0);
  const promedioVentas = productos.length > 0 ? totalVendido / productos.length : 0;

  const matrizCompleta = productos.map((producto) => {
    const venta = ventas.find((item) => item.productoId === producto.id);
    const cantidad = venta?._sum.cantidad ?? 0;
    const precio = Number(producto.precio);
    const margen = precio - precio * 0.6;
    const esPopular = cantidad >= promedioVentas;
    const esRentable = margen > precio * 0.3;

    let clasificacion = "PERRO";
    if (esPopular && esRentable) clasificacion = "ESTRELLA";
    else if (esPopular && !esRentable) clasificacion = "CABALLO";
    else if (!esPopular && esRentable) clasificacion = "ROMPECABEZAS";

    return {
      id: producto.id,
      nombre: producto.nombre,
      cantidad,
      margen: margen.toFixed(2),
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
    promedioVentas: promedioVentas.toFixed(2),
    conteos,
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

// ---------- Inventario ----------
export interface InventarioCritico {
  id: number;
  nombre: string;
  stock: number | null;
  categoria: { nombre: string } | null;
}

export interface InventarioReport {
  critico: InventarioCritico[];
  resumen: { totalProductosCriticos: number; valorizacionBodega: string };
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getInventarioReport(page = 1): Promise<InventarioReport> {
  const criticoCompleto = await prisma.producto.findMany({
    where: { stock: { lte: 10 } },
    select: {
      id: true,
      nombre: true,
      stock: true,
      categoria: { select: { nombre: true } },
    },
    orderBy: { stock: "asc" },
  });

  const productos = await prisma.producto.findMany({
    select: { precio: true, stock: true },
  });

  const valorizacion = productos.reduce((acc, producto) => {
    const costoSimulado = Number(producto.precio) * 0.4;
    return acc + Number(producto.stock ?? 0) * costoSimulado;
  }, 0);

  const { items, total, page: current, pageSize, totalPages } = paginate(
    criticoCompleto,
    page
  );

  return {
    critico: items,
    resumen: {
      totalProductosCriticos: criticoCompleto.length,
      valorizacionBodega: valorizacion.toFixed(2),
    },
    total,
    page: current,
    pageSize,
    totalPages,
  };
}

// ---------- Desempeño del personal ----------
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
    where: { estado: "Pagado", NOT: { usuarioId: null } },
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
