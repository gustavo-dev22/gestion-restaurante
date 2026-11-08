'use client';
import { useEffect, useState, use } from 'react';
import { Utensils, ShoppingCart, Plus, RefreshCw, Check, AlertCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastSuccess, toastError, toastInfo } from '@/components/ui/Toast';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MenuDigitalPage({ params }: PageProps) {
    const unwrappedParams = use(params);
    const mesaId = unwrappedParams.id;

    const [productos, setProductos] = useState<any[]>([]);
    const [carrito, setCarrito] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [estadoMesa, setEstadoMesa] = useState<string>('Libre'); // Nuevo estado
    const [numeroMesa, setNumeroMesa] = useState<string>('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
      const cargarDatos = async () => {
        try {
          setLoading(true);

          // 1. Verificar estado de la mesa primero
          const resMesa = await fetch(`/api/public/mesas/${mesaId}`);
          const dataMesa = await resMesa.json();

          console.log("DATOS DE LA MESA RECIBIDOS:", dataMesa);

          if (dataMesa.error) {
            setEstadoMesa('Error');
            return;
          }

          setNumeroMesa(dataMesa.numero);
          setEstadoMesa(dataMesa.estado);

          if (dataMesa.estado === 'Libre') {
            const resProd = await fetch('/api/public/productos');
            const dataProd = await resProd.json();
            setProductos(dataProd);
          }
        } catch (error) {
          console.error("Error al cargar datos:", error);
        } finally {
          setLoading(false);
        }
      };

      if (mesaId) cargarDatos();
    }, [mesaId]);

    const agregarAlCarrito = (producto: any) => {
        setCarrito(prev => {
        const existe = prev.find(item => item.id === producto.id);
        if (existe) {
            return prev.map(item => item.id === producto.id 
            ? { ...item, cantidad: item.cantidad + 1 } : item);
        }
        return [...prev, { ...producto, cantidad: 1 }];
        });
    };

    const confirmarPedido = async () => {
        const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        setSending(true);
        try {
            const res = await fetch('/api/public/pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mesaId, items: carrito, total }),
            });

            if (!res.ok) throw new Error();

            setConfirmOpen(false);
            setCarrito([]);
            toastSuccess('¡Pedido recibido!', 'Tu orden está siendo procesada.');
        } catch {
            toastError('No se pudo enviar el pedido', 'Intenta nuevamente en unos segundos.');
        } finally {
            setSending(false);
        }
    };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="font-bold text-slate-600">Verificando mesa...</p>
    </div>
  );

  // Pantalla de Bloqueo si la mesa no está LIBRE
  if (estadoMesa !== 'Libre') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-rose-100 p-6 rounded-full mb-6">
          <AlertCircle size={60} className="text-rose-600" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 uppercase italic mb-2">Mesa {numeroMesa}</h1>
        <div className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-6 ${
          estadoMesa === 'Ocupada' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
        }`}>
          Estado: {estadoMesa}
        </div>
        <p className="text-slate-500 font-medium max-w-xs mb-8">
          Esta mesa ya se encuentra siendo atendida o está reservada. Por favor, solicita ayuda a un mesero o escanea otro QR.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            type="button"
            onClick={() => toastInfo('Solicita ayuda', 'Por favor, llama a un mesero para continuar.')}
            className="rounded-2xl bg-blue-600 px-8 py-4 font-bold text-white shadow-lg transition-all hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Llamar al Mesero
          </button>
          <button 
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-bold uppercase text-slate-600 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Actualizar Estado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header Visual */}
      <div className="bg-slate-900 text-white p-8 rounded-b-[3rem] shadow-xl mb-6">
        <h1 className="text-3xl font-black italic tracking-tighter">CARTA DIGITAL</h1>
        <p className="text-slate-300 text-xs font-bold uppercase tracking-widest">Mesa #{numeroMesa || mesaId}</p>
      </div>

      <div className="px-4 space-y-4">
        {productos.map((prod) => (
          <div key={prod.id} className="bg-white rounded-3xl p-4 flex gap-4 shadow-sm border border-slate-100">
            <div className="h-24 w-24 bg-slate-100 rounded-2xl flex-shrink-0 overflow-hidden">
               {/* Aquí podrías poner la imagen del producto */}
               <div className="h-full w-full flex items-center justify-center text-slate-300">
                 <Utensils size={30} />
               </div>
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">{prod.nombre}</h3>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">{prod.descripcion}</p>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-black text-blue-600 italic">S/ {Number(prod.precio).toFixed(2)}</span>
                <button 
                  type="button"
                  onClick={() => agregarAlCarrito(prod)}
                  aria-label={`Agregar ${prod.nombre} al pedido`}
                  className="rounded-xl bg-blue-600 p-2 text-white shadow-lg shadow-blue-100 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de Carrito Flotante */}
      {carrito.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-100 p-6 rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full duration-500 z-50">
            <div className="max-w-md mx-auto">
            <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 flex justify-between">
                Tu Pedido <span>{carrito.length} ítems</span>
            </h4>
            
            {/* Lista de productos seleccionados */}
            <div className="max-h-40 overflow-y-auto mb-6 space-y-3 pr-2 custom-scrollbar">
                {carrito.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                    <span className="bg-blue-600 text-white text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full">
                        {item.cantidad}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{item.nombre}</span>
                    </div>
                    <span className="text-sm font-black text-slate-600">
                    S/ {(item.precio * item.cantidad).toFixed(2)}
                    </span>
                </div>
                ))}
            </div>

            {/* Botón de Envío */}
            <button 
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-900 p-5 text-white shadow-xl transition-all hover:bg-blue-600 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
                <div className="flex items-center gap-3">
                <ShoppingCart size={20} className="text-blue-400" />
                <span className="font-black text-lg">CONFIRMAR S/ {carrito.reduce((acc, i) => acc + (i.precio * i.cantidad), 0).toFixed(2)}</span>
                </div>
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
            description={`Total a pagar: S/ ${carrito
                .reduce((acc, item) => acc + item.precio * item.cantidad, 0)
                .toFixed(2)}`}
            confirmLabel="Sí, enviar pedido"
            variant="default"
            loading={sending}
        />
    </div>
  );
}