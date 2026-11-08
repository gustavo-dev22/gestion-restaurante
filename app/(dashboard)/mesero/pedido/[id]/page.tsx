'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { 
  ShoppingCart, Plus, Minus, ChevronLeft, 
  Loader2, Save, UtensilsCrossed, X 
} from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/components/ui/Toast';
import { http, getErrorMessage } from '@/lib/http';
import { formatCurrency } from '@/lib/utils';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { enqueueRequest, isOfflineError } from '@/lib/offline-queue';

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="h-full w-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
        <UtensilsCrossed size={28} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="80px"
      className="rounded-xl object-cover"
      onError={() => setFailed(true)}
    />
  );
}

interface ProductoPedido {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  imagen_url: string | null;
  categoriaId: number;
  activo: boolean;
}

interface CategoriaPedido {
  id: number;
  nombre: string;
}

interface CarritoItem extends ProductoPedido {
  cantidad: number;
}
export default function TomaPedidoPage() {
  const params = useParams();
  const router = useRouter();
  const [productos, setProductos] = useState<ProductoPedido[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPedido[]>([]);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [yaTeniaItems, setYaTeniaItems] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartPanelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(cartOpen, cartPanelRef, () => setCartOpen(false));
  const [discardOpen, setDiscardOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productosData, categoriasData, datosPedido] = await Promise.all([
          http.get<ProductoPedido[]>('/api/productos'),
          http.get<CategoriaPedido[]>('/api/categorias'),
          http.get<{ detalles?: unknown[] }>(`/api/mesero/pedido/resumen?id=${params.id}`),
        ]);
        setProductos(productosData);
        setCategorias(categoriasData);

        // Si el pedido ya tiene detalles en la BD, marcamos como true
        if (datosPedido.detalles && datosPedido.detalles.length > 0) {
          setYaTeniaItems(true);
        }
      } catch (error) {
        console.error("Error cargando datos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id]);

  const handleBack = () => {
    // Pedido con items en DB: si hay carrito pendiente, confirmar descarte.
    if (yaTeniaItems) {
      if (carrito.length > 0) setDiscardOpen(true);
      else router.back();
      return;
    }
    // Pedido vacío en DB: ofrecer liberar la mesa para no dejar pedidos fantasma.
    setCancelOpen(true);
  };

  const cancelarApertura = async () => {
    setCanceling(true);
    try {
      await http.delete(`/api/mesero/pedido/cancelar?id=${params.id}`);
      setCancelOpen(false);
      toastSuccess('Mesa liberada', 'La apertura del pedido fue anulada.');
      router.push('/mesero/salon');
    } catch {
      toastError('No se pudo liberar la mesa', 'Intenta nuevamente en unos segundos.');
    } finally {
      setCanceling(false);
    }
  };

  const agregarAlCarrito = (producto: ProductoPedido) => {
    setCarrito((prev) => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        return prev.map(item => 
          item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (id: number) => {
    setCarrito((prev) => prev.map(item => 
      item.id === id ? { ...item, cantidad: Math.max(0, item.cantidad - 1) } : item
    ).filter(item => item.cantidad > 0));
  };

  const total = carrito.reduce((acc, item) => acc + (Number(item.precio) * item.cantidad), 0);
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  const requestSend = () => {
    if (carrito.length === 0) {
      toastWarning('Carrito vacío', 'Debes seleccionar al menos un producto.');
      return;
    }
    setSendOpen(true);
  };

  const guardarComanda = async () => {
    setSending(true);
    try {
      await http.post('/api/mesero/pedido/detalle', { pedidoId: params.id, items: carrito });

      setSendOpen(false);
      toastSuccess('Comanda enviada', 'La comanda fue procesada correctamente.');
      router.push('/mesero/salon');
    } catch (error) {
      if (isOfflineError(error)) {
        enqueueRequest({
          url: '/api/mesero/pedido/detalle',
          method: 'POST',
          body: { pedidoId: params.id, items: carrito },
          label: `Comanda pedido #${params.id}`,
        });
        setSendOpen(false);
        setCarrito([]);
        toastInfo(
          'Sin conexión',
          'La comanda quedó en cola y se enviará al recuperar el Wi-Fi.'
        );
        router.push('/mesero/salon');
        return;
      }

      toastError(
        'No se pudo registrar la comanda',
        getErrorMessage(error, 'Intenta nuevamente en unos segundos.')
      );
    } finally {
      setSending(false);
    }
  };

  const getLabelCategoria = (nombre: string, cantidad: number) => {
    const n = nombre.toLowerCase();
    let label = nombre; // Valor por defecto

    if (n.includes('entrada')) label = cantidad === 1 ? 'Entrada' : 'Entradas';
    else if (n.includes('fondo')) label = cantidad === 1 ? 'Plato de Fondo' : 'Platos de Fondo';
    else if (n.includes('bebida')) label = cantidad === 1 ? 'Bebida' : 'Bebidas';
    else if (n.includes('postre')) label = cantidad === 1 ? 'Postre' : 'Postres';
    else if (n.includes('extra')) label = cantidad === 1 ? 'Extra' : 'Extras';
    // Puedes seguir agregando casos según tus categorías

    return `${cantidad} ${label}`;
  };

  if (loading) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
      <Loader2 className="animate-spin" size={40} />
      <p>Cargando carta digital...</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-50 lg:flex-row">
      
      {/* SECCIÓN IZQUIERDA: CARTA DE PRODUCTOS AGRUPADA */}
      <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 lg:pb-6">
        <div className="flex items-center gap-4 mb-8">
           <button 
             type="button"
             onClick={handleBack} 
             aria-label="Volver al salón"
             className="rounded-full bg-white p-2 shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
           >
             <ChevronLeft size={24} className="text-slate-600" />
           </button>
           <div>
             <h1 className="text-2xl font-bold text-slate-800">Carta Digital</h1>
             <p className="text-sm text-slate-500">Añadiendo platos al Pedido #{params.id}</p>
           </div>
        </div>

        {/* Mapeo de Categorías con sus respectivos productos */}
        <div className="space-y-12">
          {categorias.map((cat) => {
            const productosDeCategoria = productos.filter(p => p.categoriaId === cat.id && p.activo === true);
            if (productosDeCategoria.length === 0) return null;

            return (
              <div key={cat.id}>
                {/* Franja de Categoría */}
                <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-3">
                  <div className="p-2 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-100">
                    <UtensilsCrossed size={18} />
                  </div>
                  <h2 className="text-xl font-black text-slate-700 uppercase tracking-widest">
                    {cat.nombre}
                  </h2>
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {getLabelCategoria(cat.nombre, productosDeCategoria.length)}
                  </span>
                </div>

                {/* Grid de Productos */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {productosDeCategoria.map(prod => (
                    <div 
                      key={prod.id} 
                      onClick={() => agregarAlCarrito(prod)}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex gap-4 group relative overflow-hidden"
                    >
                      <div className="relative h-20 w-20 flex-shrink-0">
                        <ProductThumb src={prod.imagen_url} alt={prod.nombre} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {prod.nombre}
                        </h3>
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">
                          {prod.descripcion || 'Sin descripción disponible.'}
                        </p>
                        <div className="flex justify-between items-center">
                          <p className="font-black text-blue-600">{formatCurrency(prod.precio)}</p>
                          <div className="bg-blue-50 text-blue-600 p-1.5 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all">
                            <Plus size={14}/>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN DERECHA: RESUMEN / CARRITO (solo desktop) */}
      <div className="relative z-10 hidden w-96 flex-col border-l border-slate-200 bg-white p-6 shadow-2xl lg:flex">
        <div className="flex items-center gap-3 mb-8 text-slate-800 border-b pb-4">
           <div className="p-2 bg-slate-100 rounded-lg">
             <ShoppingCart size={22} className="text-slate-600" />
           </div>
           <h2 className="text-xl font-bold">Comanda Actual</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-40">
              <Plus size={48} className="mb-2" />
              <p className="text-center text-sm font-medium">Selecciona platos de la carta para empezar</p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-700 truncate">{item.nombre}</p>
                  <p className="text-xs text-blue-600 font-bold">{formatCurrency(Number(item.precio) * item.cantidad)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button 
                    type="button"
                    aria-label={`Quitar uno de ${item.nombre}`}
                    onClick={(e) => { e.stopPropagation(); quitarDelCarrito(item.id); }} 
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border bg-white text-slate-600 shadow-sm transition-all hover:border-red-200 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Minus size={14}/>
                  </button>
                  <span className="w-6 text-center font-bold text-slate-700">{item.cantidad}</span>
                  <button 
                    type="button"
                    aria-label={`Agregar uno de ${item.nombre}`}
                    onClick={(e) => { e.stopPropagation(); agregarAlCarrito(item); }} 
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border bg-white text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Plus size={14}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer del Carrito */}
        <div className="border-t border-slate-100 pt-6 mt-6">
          <div className="flex justify-between items-end mb-6">
            <span className="text-slate-600 font-bold uppercase text-xs tracking-widest">Total Pedido</span>
            <span className="text-3xl font-black text-slate-800">{formatCurrency(total)}</span>
          </div>
          <button 
            onClick={requestSend}
            disabled={carrito.length === 0}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all ${
              carrito.length === 0 
              ? 'bg-slate-100 text-slate-600 cursor-not-allowed shadow-none' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 active:scale-95'
            }`}
          >
            <Save size={20} /> Enviar a Cocina
          </button>
        </div>
      </div>

      {/* Barra inferior móvil/tablet */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] lg:hidden">
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-expanded={cartOpen}
          aria-controls="cart-drawer"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white transition-colors hover:bg-slate-800"
        >
          <span className="flex items-center gap-2 font-bold">
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs">
              {totalItems}
            </span>
            Ver comanda
          </span>
          <span className="font-black">{formatCurrency(total)}</span>
        </button>
      </div>

      {/* Drawer inferior móvil/tablet */}
      <div
        onClick={() => setCartOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden ${
          cartOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        ref={cartPanelRef}
        id="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Comanda actual"
        aria-hidden={!cartOpen}
        inert={!cartOpen}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl bg-white p-5 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden ${
          cartOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-slate-600" />
            <h2 className="text-lg font-bold text-slate-800">Comanda Actual</h2>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            aria-label="Cerrar comanda"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-600 opacity-60">
              <Plus size={40} className="mb-2" />
              <p className="text-center text-sm font-medium">Selecciona platos de la carta para empezar</p>
            </div>
          ) : (
            carrito.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-700">{item.nombre}</p>
                  <p className="text-xs font-bold text-blue-600">{formatCurrency(Number(item.precio) * item.cantidad)}</p>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Quitar uno de ${item.nombre}`}
                    onClick={() => quitarDelCarrito(item.id)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border bg-white text-slate-600 shadow-sm transition-all hover:border-red-200 hover:text-red-500"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-bold text-slate-700">{item.cantidad}</span>
                  <button
                    type="button"
                    aria-label={`Agregar uno de ${item.nombre}`}
                    onClick={() => agregarAlCarrito(item)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border bg-white text-slate-600 shadow-sm transition-all hover:border-blue-200 hover:text-blue-600"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-4 flex items-end justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Total Pedido</span>
            <span className="text-3xl font-black text-slate-800">{formatCurrency(total)}</span>
          </div>
          <button
            type="button"
            onClick={requestSend}
            disabled={carrito.length === 0}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 font-bold shadow-lg transition-all ${
              carrito.length === 0
                ? "cursor-not-allowed bg-slate-100 text-slate-600 shadow-none"
                : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
            }`}
          >
            <Save size={20} /> Enviar a Cocina
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          router.back();
        }}
        title="¿Descartar cambios?"
        description="Los nuevos platos en el carrito no se guardarán."
        confirmLabel="Sí, salir"
        cancelLabel="Seguir pidiendo"
        variant="warning"
      />

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={cancelarApertura}
        title="¿Anular apertura?"
        description="No has enviado nada a cocina. ¿Deseas liberar la mesa y cancelar el pedido?"
        confirmLabel="Sí, liberar mesa"
        cancelLabel="No, seguir pidiendo"
        variant="danger"
        loading={canceling}
      />

      <ConfirmDialog
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        onConfirm={guardarComanda}
        title="¿Enviar comanda?"
        description={`Se registrarán ${carrito.length} tipos de platos en el pedido.`}
        confirmLabel="Sí, enviar a cocina"
        cancelLabel="Revisar"
        variant="default"
        loading={sending}
      />
    </div>
  );
}