"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Package, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, selectBase } from "@/components/ui/Input";
import { Label } from "@/components/ui/Field";
import { DataTable } from "@/components/ui/DataTable";
import { toastError, toastSuccess } from "@/components/ui/Toast";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";

interface Unidad {
  id: number;
  codigo: string;
  nombre: string;
}

interface Almacen {
  id: number;
  codigo: string;
  nombre: string;
}

interface Insumo {
  id: number;
  nombre: string;
  unidadBase: Unidad;
  stockMinimo: number;
  puntoRecompra: number;
  leadTimeDias: number;
  costoPromedio: number;
  stocks: Array<{ almacenId: number; cantidad: number }>;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  tipoInventario: string;
  receta: {
    rendimiento: number;
    mermaPorcentaje: number;
    activo: boolean;
    detalles: Array<{ insumoId: number; insumoNombre: string; cantidad: number }>;
  } | null;
}

interface Movimiento {
  id: number;
  tipo: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
  motivo: string | null;
  creadoEn: string;
  insumo: string;
  unidad: string;
  almacen: string;
  almacenDestino: string | null;
  responsable: string | null;
}

interface InventarioData {
  insumos: Insumo[];
  almacenes: Almacen[];
  unidades: Unidad[];
  productos: Producto[];
  movimientos: Movimiento[];
  canManage: boolean;
  canWaste: boolean;
  canCount: boolean;
  canTransfer: boolean;
  canPurchase: boolean;
}

interface RecetaFila {
  insumoId: string;
  cantidad: string;
}

export default function InventarioClient({ initialData }: { initialData: InventarioData }) {
  const router = useRouter();
  const [insumoForm, setInsumoForm] = useState({
    nombre: "",
    unidadBaseId: String(initialData.unidades[0]?.id ?? ""),
    stockMinimo: "0",
    puntoRecompra: "0",
    leadTimeDias: "0",
  });
  const [insumoSaving, setInsumoSaving] = useState(false);

  const [movimientoForm, setMovimientoForm] = useState({
    insumoId: String(initialData.insumos[0]?.id ?? ""),
    tipo: initialData.canPurchase
      ? "COMPRA"
      : initialData.canWaste
        ? "MERMA"
        : initialData.canTransfer
          ? "TRANSFERENCIA"
          : "CONTEO",
    almacenId: String(initialData.almacenes[0]?.id ?? ""),
    almacenDestinoId: String(initialData.almacenes[1]?.id ?? ""),
    cantidad: "",
    costoUnitario: "",
    motivo: "",
  });
  const [movimientoSaving, setMovimientoSaving] = useState(false);

  const insumoSeleccionadoId = initialData.insumos.some(
    (insumo) => String(insumo.id) === movimientoForm.insumoId
  )
    ? movimientoForm.insumoId
    : String(initialData.insumos[0]?.id ?? "");

  const almacenSeleccionadoId = initialData.almacenes.some(
    (almacen) => String(almacen.id) === movimientoForm.almacenId
  )
    ? movimientoForm.almacenId
    : String(initialData.almacenes[0]?.id ?? "");

  const almacenDestinoSeleccionadoId = initialData.almacenes.some(
    (almacen) =>
      String(almacen.id) === movimientoForm.almacenDestinoId &&
      String(almacen.id) !== almacenSeleccionadoId
  )
    ? movimientoForm.almacenDestinoId
    : String(
        initialData.almacenes.find(
          (almacen) => String(almacen.id) !== almacenSeleccionadoId
        )?.id ?? ""
      );

  const [recetaForm, setRecetaForm] = useState({
    productoId: String(initialData.productos[0]?.id ?? ""),
    rendimiento: "1",
    mermaPorcentaje: "0",
    filas: [{ insumoId: "", cantidad: "" }] as RecetaFila[],
  });
  const [recetaSaving, setRecetaSaving] = useState(false);

  const productosConReceta = useMemo(
    () => initialData.productos.filter((producto) => producto.receta),
    [initialData.productos]
  );

  const stockTotal = (insumo: Insumo) =>
    insumo.stocks.reduce((total, stock) => total + stock.cantidad, 0);

  const esBajo = (insumo: Insumo) => {
    const total = stockTotal(insumo);
    return (
      (insumo.stockMinimo > 0 && total <= insumo.stockMinimo) ||
      (insumo.puntoRecompra > 0 && total <= insumo.puntoRecompra)
    );
  };

  const insumosBajos = initialData.insumos.filter(esBajo);

  const tiposDisponibles = [
    initialData.canPurchase ? "COMPRA" : null,
    initialData.canWaste ? "MERMA" : null,
    initialData.canCount ? "AJUSTE" : null,
    initialData.canTransfer ? "TRANSFERENCIA" : null,
    initialData.canCount ? "CONTEO" : null,
  ].filter((tipo): tipo is string => Boolean(tipo));

  const crearInsumo = async (event: React.FormEvent) => {
    event.preventDefault();
    setInsumoSaving(true);
    try {
      await http.post("/api/inventario/insumos", {
        nombre: insumoForm.nombre.trim(),
        unidadBaseId: Number(insumoForm.unidadBaseId),
        stockMinimo: Number(insumoForm.stockMinimo || 0),
        puntoRecompra: Number(insumoForm.puntoRecompra || 0),
        leadTimeDias: Number(insumoForm.leadTimeDias || 0),
      });
      toastSuccess("Insumo creado", "Ya está disponible para recetas y movimientos.");
      setInsumoForm((prev) => ({ ...prev, nombre: "" }));
      router.refresh();
    } catch (error) {
      toastError("No se pudo crear el insumo", getErrorMessage(error));
    } finally {
      setInsumoSaving(false);
    }
  };

  const registrarMovimiento = async (event: React.FormEvent) => {
    event.preventDefault();
    setMovimientoSaving(true);
    try {
      await http.post("/api/inventario/movimientos", {
        insumoId: Number(insumoSeleccionadoId),
        tipo: movimientoForm.tipo,
        almacenId: Number(almacenSeleccionadoId),
        almacenDestinoId:
          movimientoForm.tipo === "TRANSFERENCIA"
            ? Number(almacenDestinoSeleccionadoId)
            : null,
        cantidad: Number(movimientoForm.cantidad),
        costoUnitario:
          movimientoForm.tipo === "COMPRA"
            ? Number(movimientoForm.costoUnitario || 0)
            : undefined,
        motivo: movimientoForm.motivo.trim() || undefined,
      });
      toastSuccess("Movimiento registrado", "El stock fue actualizado.");
      setMovimientoForm((prev) => ({ ...prev, cantidad: "", costoUnitario: "", motivo: "" }));
      router.refresh();
    } catch (error) {
      toastError("No se pudo registrar el movimiento", getErrorMessage(error));
    } finally {
      setMovimientoSaving(false);
    }
  };

  const seleccionarProducto = (productoId: string) => {
    const producto = initialData.productos.find((item) => String(item.id) === productoId);
    setRecetaForm({
      productoId,
      rendimiento: producto?.receta ? String(producto.receta.rendimiento) : "1",
      mermaPorcentaje: producto?.receta
        ? String(producto.receta.mermaPorcentaje)
        : "0",
      filas:
        producto?.receta && producto.receta.detalles.length > 0
          ? producto.receta.detalles.map((detalle) => ({
              insumoId: String(detalle.insumoId),
              cantidad: String(detalle.cantidad),
            }))
          : [{ insumoId: "", cantidad: "" }],
    });
  };

  const actualizarFila = (index: number, campo: keyof RecetaFila, valor: string) => {
    setRecetaForm((prev) => ({
      ...prev,
      filas: prev.filas.map((fila, i) => (i === index ? { ...fila, [campo]: valor } : fila)),
    }));
  };

  const guardarReceta = async (event: React.FormEvent) => {
    event.preventDefault();
    setRecetaSaving(true);
    try {
      await http.post("/api/inventario/recetas", {
        productoId: Number(recetaForm.productoId),
        rendimiento: Number(recetaForm.rendimiento),
        mermaPorcentaje: Number(recetaForm.mermaPorcentaje || 0),
        activo: true,
        detalles: recetaForm.filas
          .filter((fila) => fila.insumoId && Number(fila.cantidad) > 0)
          .map((fila) => ({
            insumoId: Number(fila.insumoId),
            cantidad: Number(fila.cantidad),
          })),
      });
      toastSuccess("Receta guardada", "El producto consumirá insumos al iniciar cocina.");
      router.refresh();
    } catch (error) {
      toastError("No se pudo guardar la receta", getErrorMessage(error));
    } finally {
      setRecetaSaving(false);
    }
  };

  const costoReceta = useMemo(() => {
    const total = recetaForm.filas.reduce((acc, fila) => {
      const insumo = initialData.insumos.find((item) => String(item.id) === fila.insumoId);
      return acc + (insumo ? insumo.costoPromedio * Number(fila.cantidad || 0) : 0);
    }, 0);
    const rendimiento = Number(recetaForm.rendimiento || 1);
    const merma = Number(recetaForm.mermaPorcentaje || 0);
    return total > 0 && rendimiento > 0 ? (total / rendimiento) * (1 + merma / 100) : 0;
  }, [recetaForm, initialData.insumos]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-bold uppercase text-slate-500">Insumos activos</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{initialData.insumos.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase text-slate-500">Stock bajo</p>
          <p className="mt-1 text-2xl font-black text-rose-600">{insumosBajos.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-bold uppercase text-slate-500">Productos con receta</p>
          <p className="mt-1 text-2xl font-black text-slate-800">{productosConReceta.length}</p>
        </Card>
      </div>

      {insumosBajos.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 text-amber-600" size={20} aria-hidden="true" />
            <div>
              <h2 className="font-bold text-amber-900">Insumos por reabastecer</h2>
              <p className="mt-1 text-sm text-amber-800">
                {insumosBajos.map((insumo) => insumo.nombre).join(", ")}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-800">Insumos y stock por almacén</h2>
          <p className="mt-1 text-sm text-slate-600">
            El stock se maneja en la unidad base de cada insumo.
          </p>
        </div>
        <DataTable label="Insumos" minWidthClass="min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Insumo</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Unidad</th>
              {initialData.almacenes.map((almacen) => (
                <th key={almacen.id} className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-600">
                  {almacen.nombre}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-600">Costo prom.</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialData.insumos.map((insumo) => (
              <tr key={insumo.id}>
                <td className="px-4 py-3 font-semibold text-slate-800">{insumo.nombre}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{insumo.unidadBase.codigo}</td>
                {initialData.almacenes.map((almacen) => {
                  const stock = insumo.stocks.find((item) => item.almacenId === almacen.id);
                  return (
                    <td key={almacen.id} className="px-4 py-3 text-right text-sm text-slate-700">
                      {Number(stock?.cantidad ?? 0).toFixed(3)}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                  {formatCurrency(insumo.costoPromedio)}
                </td>
                <td className="px-4 py-3">
                  {esBajo(insumo) ? (
                    <Badge tone="rose">Reabastecer</Badge>
                  ) : (
                    <Badge tone="emerald">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>

      {(initialData.canManage || tiposDisponibles.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {initialData.canManage && (
          <Card className="p-5">
            <h2 className="mb-4 font-bold text-slate-800">Nuevo insumo</h2>
            <form onSubmit={crearInsumo} className="space-y-3">
              <div>
                <Label htmlFor="insumo-nombre" required>Nombre</Label>
                <Input
                  id="insumo-nombre"
                  value={insumoForm.nombre}
                  onChange={(event) => setInsumoForm({ ...insumoForm, nombre: event.target.value })}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="insumo-unidad" required>Unidad base</Label>
                  <select
                    id="insumo-unidad"
                    className={selectBase}
                    value={insumoForm.unidadBaseId}
                    onChange={(event) => setInsumoForm({ ...insumoForm, unidadBaseId: event.target.value })}
                  >
                    {initialData.unidades.map((unidad) => (
                      <option key={unidad.id} value={unidad.id}>
                        {unidad.nombre} ({unidad.codigo})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="insumo-stock">Stock mínimo</Label>
                  <Input
                    id="insumo-stock"
                    type="number"
                    min="0"
                    step="0.001"
                    value={insumoForm.stockMinimo}
                    onChange={(event) => setInsumoForm({ ...insumoForm, stockMinimo: event.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" loading={insumoSaving}>
                <Plus size={16} /> Crear insumo
              </Button>
            </form>
          </Card>
          )}

          <Card className="p-5">
            <h2 className="mb-4 font-bold text-slate-800">Registrar movimiento</h2>
            {initialData.insumos.length === 0 ? (
              <p className="text-sm text-slate-600">
                Primero crea un insumo para poder registrar movimientos.
              </p>
            ) : tiposDisponibles.length === 0 ? (
              <p className="text-sm text-slate-600">No tienes permisos para movimientos.</p>
            ) : (
              <form onSubmit={registrarMovimiento} className="space-y-3">
                <div>
                  <Label htmlFor="mov-insumo">Insumo</Label>
                  <select
                    id="mov-insumo"
                    className={selectBase}
                    value={insumoSeleccionadoId}
                    onChange={(event) => setMovimientoForm({ ...movimientoForm, insumoId: event.target.value })}
                  >
                    {initialData.insumos.map((insumo) => (
                      <option key={insumo.id} value={insumo.id}>{insumo.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="mov-tipo">Tipo</Label>
                    <select
                      id="mov-tipo"
                      className={selectBase}
                      value={movimientoForm.tipo}
                      onChange={(event) => setMovimientoForm({ ...movimientoForm, tipo: event.target.value })}
                    >
                      {tiposDisponibles.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="mov-almacen">Almacén</Label>
                    <select
                      id="mov-almacen"
                      className={selectBase}
                      value={almacenSeleccionadoId}
                      onChange={(event) => setMovimientoForm({ ...movimientoForm, almacenId: event.target.value })}
                    >
                      {initialData.almacenes.map((almacen) => (
                        <option key={almacen.id} value={almacen.id}>{almacen.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {movimientoForm.tipo === "TRANSFERENCIA" && (
                  <div>
                    <Label htmlFor="mov-destino">Almacén destino</Label>
                    <select
                      id="mov-destino"
                      className={selectBase}
                      value={almacenDestinoSeleccionadoId}
                      onChange={(event) => setMovimientoForm({ ...movimientoForm, almacenDestinoId: event.target.value })}
                    >
                      {initialData.almacenes
                        .filter((almacen) => String(almacen.id) !== almacenSeleccionadoId)
                        .map((almacen) => (
                          <option key={almacen.id} value={almacen.id}>{almacen.nombre}</option>
                        ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="mov-cantidad" required>Cantidad</Label>
                    <Input
                      id="mov-cantidad"
                      type="number"
                      step="0.001"
                      value={movimientoForm.cantidad}
                      onChange={(event) => setMovimientoForm({ ...movimientoForm, cantidad: event.target.value })}
                      required
                    />
                  </div>
                  {movimientoForm.tipo === "COMPRA" && (
                    <div>
                      <Label htmlFor="mov-costo">Costo unitario</Label>
                      <Input
                        id="mov-costo"
                        type="number"
                        min="0"
                        step="0.0001"
                        value={movimientoForm.costoUnitario}
                        onChange={(event) => setMovimientoForm({ ...movimientoForm, costoUnitario: event.target.value })}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="mov-motivo" required={["MERMA", "AJUSTE", "CONTEO"].includes(movimientoForm.tipo)}>
                    Motivo
                  </Label>
                  <Input
                    id="mov-motivo"
                    value={movimientoForm.motivo}
                    onChange={(event) => setMovimientoForm({ ...movimientoForm, motivo: event.target.value })}
                    required={["MERMA", "AJUSTE", "CONTEO"].includes(movimientoForm.tipo)}
                  />
                </div>
                <Button type="submit" loading={movimientoSaving} variant="secondary">
                  <Package size={16} /> Registrar
                </Button>
              </form>
            )}
          </Card>
        </div>
      )}

      {initialData.canManage && (
        <Card className="p-5">
          <h2 className="mb-4 font-bold text-slate-800">Receta / BOM</h2>
          <form onSubmit={guardarReceta} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="receta-producto">Producto</Label>
                <select
                  id="receta-producto"
                  className={selectBase}
                  value={recetaForm.productoId}
                  onChange={(event) => seleccionarProducto(event.target.value)}
                >
                  {initialData.productos.map((producto) => (
                    <option key={producto.id} value={producto.id}>{producto.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="receta-rendimiento">Rendimiento (porciones)</Label>
                <Input
                  id="receta-rendimiento"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={recetaForm.rendimiento}
                  onChange={(event) => setRecetaForm({ ...recetaForm, rendimiento: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="receta-merma">Merma (%)</Label>
                <Input
                  id="receta-merma"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={recetaForm.mermaPorcentaje}
                  onChange={(event) => setRecetaForm({ ...recetaForm, mermaPorcentaje: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              {recetaForm.filas.map((fila, index) => (
                <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label>Insumo</Label>
                    <select
                      className={selectBase}
                      value={fila.insumoId}
                      onChange={(event) => actualizarFila(index, "insumoId", event.target.value)}
                    >
                      <option value="">Selecciona un insumo</option>
                      {initialData.insumos.map((insumo) => (
                        <option key={insumo.id} value={insumo.id}>
                          {insumo.nombre} ({insumo.unidadBase.codigo})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-36">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={fila.cantidad}
                      onChange={(event) => actualizarFila(index, "cantidad", event.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setRecetaForm((prev) => ({
                        ...prev,
                        filas: prev.filas.filter((_, i) => i !== index),
                      }))
                    }
                    aria-label="Quitar insumo"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setRecetaForm((prev) => ({
                    ...prev,
                    filas: [...prev.filas, { insumoId: "", cantidad: "" }],
                  }))
                }
              >
                <Plus size={16} /> Agregar insumo
              </Button>
              <p className="text-sm font-semibold text-slate-700">
                Costo estimado por porción: <b>{formatCurrency(costoReceta)}</b>
              </p>
              <Button type="submit" loading={recetaSaving} disabled={recetaForm.filas.length === 0}>
                Guardar receta
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-800">Movimientos recientes</h2>
        </div>
        <DataTable label="Movimientos de inventario" minWidthClass="min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Insumo</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-600">Cantidad</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Almacén</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Motivo</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase text-slate-600">Responsable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialData.movimientos.map((movimiento) => (
              <tr key={movimiento.id}>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(movimiento.creadoEn).toLocaleString("es-PE")}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">{movimiento.insumo}</td>
                <td className="px-4 py-3"><Badge tone="blue">{movimiento.tipo}</Badge></td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  {movimiento.cantidad.toFixed(3)} {movimiento.unidad}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {movimiento.almacen}
                  {movimiento.almacenDestino ? ` → ${movimiento.almacenDestino}` : ""}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{movimiento.motivo || "—"}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{movimiento.responsable || "—"}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Card>
    </div>
  );
}
