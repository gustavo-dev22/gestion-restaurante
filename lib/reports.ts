import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPeruHour } from "@/lib/utils";

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
}

export async function getIngenieriaReport(): Promise<IngenieriaReport> {
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

  const matriz = productos.map((producto) => {
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

  return { matriz, promedioVentas: promedioVentas.toFixed(2) };
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
}

export async function getInventarioReport(): Promise<InventarioReport> {
  const critico = await prisma.producto.findMany({
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

  return {
    critico,
    resumen: {
      totalProductosCriticos: critico.length,
      valorizacionBodega: valorizacion.toFixed(2),
    },
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

export async function getPersonalReport(): Promise<PersonalRankingItem[]> {
  const estadisticas = await prisma.pedido.groupBy({
    by: ["usuarioId", "nombreMesero"],
    _sum: { total: true },
    _count: { id: true },
    where: { estado: "Pagado", NOT: { usuarioId: null } },
  });

  return estadisticas
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

// ---------- Versiones cacheadas para Server Components ----------
const CACHE_OPTIONS = { revalidate: 30, tags: ["reportes"] };

export const getHorasPicoReportCached = unstable_cache(
  getHorasPicoReport,
  ["reporte-horas-pico"],
  CACHE_OPTIONS
);

export const getIngenieriaReportCached = unstable_cache(
  getIngenieriaReport,
  ["reporte-ingenieria"],
  CACHE_OPTIONS
);

export const getInventarioReportCached = unstable_cache(
  getInventarioReport,
  ["reporte-inventario"],
  CACHE_OPTIONS
);

export const getPersonalReportCached = unstable_cache(
  getPersonalReport,
  ["reporte-personal"],
  CACHE_OPTIONS
);

export const getDashboardStatsCached = unstable_cache(
  getDashboardStats,
  ["dashboard-stats"],
  { ...CACHE_OPTIONS, tags: ["dashboard", "reportes"] }
);
