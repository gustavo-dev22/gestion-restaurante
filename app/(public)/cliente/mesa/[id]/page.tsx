"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BellRing,
  Check,
  ChefHat,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Utensils,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { toastSuccess, toastError } from "@/components/ui/Toast";
import { http } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  imagen_url: string | null;
  categoria?: { id: number; nombre: string; icono: string | null };
}

interface CarritoItem extends Producto {
  cantidad: number;
}

interface PedidoActivo {
  id: number;
  estado: string;
  total: number | string;
  mesa: { numero: string };
  detalles: {
    id: number;
    cantidad: number;
    estado: string | null;
    producto: { nombre: string };
  }[];
}

function ProductImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
        <Utensils size={30} aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="96px"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}

const ESTADO_LABEL: Record<string, string> = {
  "Por Confirmar": "Esperando confirmación del mesero",
  Pendiente: "En preparación",
  Pagado: "Finalizado",
};

export default function MenuDigitalPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const mesaId = unwrappedParams.id;

  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoMesa, setEstadoMesa] = useState("Libre");
  const [numeroMesa, setNumeroMesa] = useState("");
  const [pedidoActivo, setPedidoActivo] = useState<PedidoActivo | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cargarProductos = useCallback(async () => {
    const data = await http.get<Producto[]>("/api/public/productos", { skipAuthRedirect: true });
    setProductos(Array.isArray(data) ? data : []);
  }, []);

  const cargarEstadoPedido = useCallback(async () => {
    return http.get<PedidoActivo | null>(`/api/public/pedido?mesaId=${mesaId}`, {
      skipAuthRedirect: true,
    });
  }, [mesaId]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const dataMesa = await http.get<{ numero: string; estado: string; error?: string }>(
        `/api/public/mesas/${mesaId}`,
        { skipAuthRedirect: true }
      );

      if (dataMesa?.error) {
        setEstadoMesa("Error");
        return;
      }

      setNumeroMesa(dataMesa.numero);
      setEstadoMesa(dataMesa.estado);

      const activo = await cargarEstadoPedido();
      if (activo) {
        setPedidoActivo(activo);
        return;
      }

      if (dataMesa.estado === "Libre") {
        await cargarProductos();
      }
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setEstadoMesa("Error");
    } finally {
      setLoading(false);
    }
  }, [mesaId, cargarEstadoPedido, cargarProductos]);

  useEffect(() => {
    if (mesaId) cargarDatos();
  }, [mesaId, cargarDatos]);

  // Seguimiento en tiempo real mientras exista un pedido activo.
  useEffect(() => {
    if (!pedidoActivo) return;

    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        const activo = await cargarEstadoPedido();
        if (activo) {
          setPedidoActivo(activo);
        } else {
          setPedidoActivo(null);
          setEstadoMesa("Libre");
          await cargarProductos();
        }
      } catch {
        // Se reintenta en el siguiente ciclo.
      } finally {
        setRefreshing(false);
      }
    }, 10_000);

    return () => clearInterval(interval);
  }, [pedidoActivo, cargarEstadoPedido, cargarProductos]);

  const grupos = useMemo(() => {
    const mapa = new Map<
      number,
      { id: number; nombre: string; productos: Producto[] }
    >();

    productos.forEach((producto) => {
      const categoria = producto.categoria ?? { id: 0, nombre: "Otros", icono: null };
      if (!mapa.has(categoria.id)) {
        mapa.set(categoria.id, { id: categoria.id, nombre: categoria.nombre, productos: [] });
      }
      mapa.get(categoria.id)!.productos.push(producto);
    });

    return Array.from(mapa.values());
  }, [productos]);

  const total = carrito.reduce((acc, item) => acc + Number(item.precio) * item.cantidad, 0);
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) =>
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const reducirDelCarrito = (id: number) => {
    setCarrito((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item))
        .filter((item) => item.cantidad > 0)
    );
  };

  const quitarDelCarrito = (id: number) => {
    setCarrito((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmarPedido = async () => {
    setSending(true);
    try {
      await http.post(
        "/api/public/pedido",
        {
          mesaId,
          items: carrito.map((item) => ({
            id: item.id,
            cantidad: item.cantidad,
            precio: Number(item.precio),
          })),
          total,
        },
        { skipAuthRedirect: true }
      );

      setConfirmOpen(false);
      setCarrito([]);
      toastSuccess("¡Pedido recibido!", "Tu orden está siendo procesada.");

      const activo = await cargarEstadoPedido();
      if (activo) setPedidoActivo(activo);
    } catch {
      toastError("No se pudo enviar el pedido", "Intenta nuevamente en unos segundos.");
    } finally {
      setSending(false);
    }
  };

  const llamarMesero = async () => {
    setCalling(true);
    try {
      const data = await http.post<{ success: boolean; message: string }>(
        "/api/public/llamar-mesero",
        { mesaId },
        { skipAuthRedirect: true }
      );
      toastSuccess("Solicitud enviada", data.message);
    } catch {
      toastError("No se pudo avisar al mesero", "Intenta nuevamente o llama al personal.");
    } finally {
      setCalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <RefreshCw className="mb-4 animate-spin text-blue-600" size={40} />
        <p className="font-bold text-slate-600">Verificando mesa...</p>
      </div>
    );
  }

  // Seguimiento del pedido
  if (pedidoActivo) {
    const listos = pedidoActivo.detalles.filter((detalle) => detalle.estado === "Listo").length;
    const totalPlatos = pedidoActivo.detalles.length;

    return (
      <div className="min-h-screen bg-slate-50 pb-10">
        <div className="rounded-b-[2.5rem] bg-slate-900 p-8 text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Mesa</p>
          <h1 className="text-4xl font-black tracking-tight">{numeroMesa || pedidoActivo.mesa.numero}</h1>
          <p className="mt-1 text-sm text-slate-300">Sigue el estado de tu pedido en tiempo real</p>
        </div>

        <div className="mx-auto max-w-md space-y-4 p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800">
                <ChefHat size={22} className="text-blue-600" aria-hidden="true" />
                <span className="font-bold">{ESTADO_LABEL[pedidoActivo.estado] ?? pedidoActivo.estado}</span>
              </div>
              {refreshing && <Loader2 size={16} className="animate-spin text-slate-400" />}
            </div>

            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: totalPlatos ? `${(listos / totalPlatos) * 100}%` : "10%" }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {totalPlatos > 0
                ? `${listos} de ${totalPlatos} platos listos`
                : "Estamos confirmando tu pedido."}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-600">Tu pedido</h2>
            <div className="space-y-3">
              {pedidoActivo.detalles.map((detalle) => (
                <div key={detalle.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {detalle.cantidad} x {detalle.producto.nombre}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      detalle.estado === "Listo"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {detalle.estado === "Listo" ? "Listo" : "En preparación"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm font-medium text-slate-600">Total</span>
              <span className="text-xl font-black text-slate-800">{formatCurrency(pedidoActivo.total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button type="button" variant="outline" size="lg" onClick={llamarMesero} loading={calling}>
              <BellRing size={18} /> Llamar al mesero
            </Button>
            <Button type="button" variant="ghost" onClick={cargarDatos}>
              <RefreshCw size={16} /> Actualizar estado
            </Button>
          </div>

          <p className="text-center text-xs text-slate-500">
            El estado se actualiza automáticamente cada 10 segundos.
          </p>
        </div>
      </div>
    );
  }

  // Mesa no disponible para pedidos digitales
  if (estadoMesa !== "Libre") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
        <div className="mb-6 rounded-full bg-rose-100 p-6">
          <AlertCircle size={60} className="text-rose-600" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-3xl font-black uppercase italic text-slate-800">Mesa {numeroMesa}</h1>
        <div
          className={`mb-6 rounded-full px-4 py-1 text-xs font-black uppercase tracking-widest ${
            estadoMesa === "Ocupada" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
          }`}
        >
          Estado: {estadoMesa}
        </div>
        <p className="mb-8 max-w-xs font-medium text-slate-600">
          Esta mesa ya se encuentra siendo atendida o está reservada. Por favor, solicita ayuda a un
          mesero o escanea otro QR.
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button type="button" size="lg" onClick={llamarMesero} loading={calling}>
            <BellRing size={18} /> Llamar al Mesero
          </Button>
          <Button type="button" variant="ghost" onClick={cargarDatos}>
            <RefreshCw size={16} /> Actualizar Estado
          </Button>
        </div>
      </div>
    );
  }

  // Menú digital
  return (
    <div className="min-h-screen bg-slate-50 pb-36">
      <div className="mb-6 rounded-b-[2.5rem] bg-slate-900 p-8 text-white shadow-xl">
        <h1 className="text-3xl font-black italic tracking-tighter">CARTA DIGITAL</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-slate-300">
          Mesa {numeroMesa || mesaId}
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-8 px-4">
        {grupos.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-600">
            No hay productos disponibles por el momento.
          </div>
        ) : (
          grupos.map((grupo) => (
            <section key={grupo.id}>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-700">
                {grupo.nombre}
              </h2>
              <div className="space-y-3">
                {grupo.productos.map((producto) => {
                  const enCarrito = carrito.find((item) => item.id === producto.id)?.cantidad ?? 0;
                  return (
                    <div
                      key={producto.id}
                      className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl">
                        <ProductImage src={producto.imagen_url} alt={producto.nombre} />
                      </div>
                      <div className="flex flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-bold leading-tight text-slate-800">{producto.nombre}</h3>
                            {enCarrito > 0 && (
                              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-bold text-white">
                                {enCarrito}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{producto.descripcion}</p>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-black text-blue-700">{formatCurrency(producto.precio)}</span>
                          <button
                            type="button"
                            onClick={() => agregarAlCarrito(producto)}
                            aria-label={`Agregar ${producto.nombre} al pedido`}
                            className="rounded-xl bg-blue-600 p-2 text-white shadow-lg shadow-blue-100 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Carrito flotante */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[2rem] border-t-2 border-slate-100 bg-white p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] sm:p-6">
          <div className="mx-auto max-w-md">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-700">
                <ShoppingCart size={16} /> Tu pedido
              </h4>
              <span className="text-sm font-bold text-slate-600">{totalItems} ítems</span>
            </div>

            <div className="mb-4 max-h-52 space-y-2 overflow-y-auto pr-1">
              {carrito.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-700">{item.nombre}</p>
                    <p className="text-xs font-bold text-blue-700">
                      {formatCurrency(Number(item.precio) * item.cantidad)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Quitar uno de ${item.nombre}`}
                      onClick={() => reducirDelCarrito(item.id)}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-slate-700">{item.cantidad}</span>
                    <button
                      type="button"
                      aria-label={`Agregar uno de ${item.nombre}`}
                      onClick={() => agregarAlCarrito(item)}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${item.nombre} del pedido`}
                      onClick={() => quitarDelCarrito(item.id)}
                      className="rounded-lg border border-transparent p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-xl transition-all hover:bg-blue-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <span className="flex items-center gap-3">
                <ShoppingCart size={20} className="text-blue-400" />
                <span className="text-lg font-black">CONFIRMAR {formatCurrency(total)}</span>
              </span>
              <Check size={20} />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmarPedido}
        title="¿Confirmar pedido?"
        description={`Total a pagar: ${formatCurrency(total)}`}
        confirmLabel="Sí, enviar pedido"
        variant="default"
        loading={sending}
      />
    </div>
  );
}
