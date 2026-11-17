import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import InventarioClient from "@/components/inventario/InventarioClient";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth/server-session";
import { getLocalUserContext } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const context = await getLocalUserContext(session);
  if (!context?.permissions.has("inventory:read")) {
    redirect(session.home || "/dashboard");
  }

  const [insumos, almacenes, unidades, productos, movimientos] = await Promise.all([
    prisma.insumo.findMany({
      where: { activo: true },
      include: { unidadBase: true, stocks: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.almacen.findMany({ where: { activo: true }, orderBy: { id: "asc" } }),
    prisma.unidadMedida.findMany({ where: { activo: true }, orderBy: { id: "asc" } }),
    prisma.producto.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        precio: true,
        tipoInventario: true,
        receta: {
          include: {
            detalles: {
              include: { insumo: { select: { id: true, nombre: true } } },
            },
          },
        },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.insumoMovimiento.findMany({
      include: {
        insumo: { select: { nombre: true, unidadBase: { select: { codigo: true } } } },
        almacen: { select: { nombre: true } },
        almacenDestino: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const data = {
    insumos: insumos.map((insumo) => ({
      id: insumo.id,
      nombre: insumo.nombre,
      unidadBase: {
        id: insumo.unidadBase.id,
        codigo: insumo.unidadBase.codigo,
        nombre: insumo.unidadBase.nombre,
      },
      stockMinimo: Number(insumo.stockMinimo),
      puntoRecompra: Number(insumo.puntoRecompra),
      leadTimeDias: insumo.leadTimeDias,
      costoPromedio: Number(insumo.costoPromedio),
      stocks: insumo.stocks.map((stock) => ({
        almacenId: stock.almacenId,
        cantidad: Number(stock.cantidad),
      })),
    })),
    almacenes: almacenes.map((almacen) => ({
      id: almacen.id,
      codigo: almacen.codigo,
      nombre: almacen.nombre,
    })),
    unidades: unidades.map((unidad) => ({
      id: unidad.id,
      codigo: unidad.codigo,
      nombre: unidad.nombre,
    })),
    productos: productos.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      precio: Number(producto.precio),
      tipoInventario: producto.tipoInventario,
      receta: producto.receta
        ? {
            rendimiento: Number(producto.receta.rendimiento),
            mermaPorcentaje: Number(producto.receta.mermaPorcentaje),
            activo: producto.receta.activo,
            detalles: producto.receta.detalles.map((detalle) => ({
              insumoId: detalle.insumoId,
              insumoNombre: detalle.insumo.nombre,
              cantidad: Number(detalle.cantidad),
            })),
          }
        : null,
    })),
    movimientos: movimientos.map((movimiento) => ({
      id: movimiento.id,
      tipo: movimiento.tipo,
      cantidad: Number(movimiento.cantidad),
      costoUnitario: Number(movimiento.costoUnitario),
      costoTotal: Number(movimiento.costoTotal),
      motivo: movimiento.motivo,
      creadoEn: movimiento.createdAt.toISOString(),
      insumo: movimiento.insumo.nombre,
      unidad: movimiento.insumo.unidadBase.codigo,
      almacen: movimiento.almacen.nombre,
      almacenDestino: movimiento.almacenDestino?.nombre ?? null,
      responsable: movimiento.responsableNombre,
    })),
    canManage: context.permissions.has("inventory:manage"),
    canWaste: context.permissions.has("inventory:waste"),
    canCount: context.permissions.has("inventory:count"),
    canTransfer: context.permissions.has("inventory:transfer"),
    canPurchase: context.permissions.has("inventory:purchase"),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Inventario real"
        description="Insumos, recetas, stock por almacén, costos y movimientos."
      />
      <InventarioClient initialData={data} />
    </div>
  );
}
