'use client';
import { useEffect, useState, use } from 'react';
import { Utensils, ShoppingCart, Plus, RefreshCw, Check, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

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

    const enviarPedido = async () => {
        const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
        
        const confirm = await Swal.fire({
            title: '¿Confirmar Pedido?',
            text: `Total a pagar: S/ ${total.toFixed(2)}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, enviar pedido',
            allowEscapeKey: false,
            allowOutsideClick: false
        });

        if (confirm.isConfirmed) {
        Swal.fire({ title: 'Enviando a cocina...', allowEscapeKey: false, didOpen: () => Swal.showLoading() });

        const res = await fetch('/api/public/pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesaId: mesaId,
                items: carrito,
                total: total
            })
        });

        if (res.ok) {
            Swal.fire('¡Pedido Recibido!', 'Tu orden está siendo procesada.', 'success');
            setCarrito([]);
        }
        }
    };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="font-bold text-slate-400">Verificando mesa...</p>
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
        <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 ${
          estadoMesa === 'Ocupada' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
        }`}>
          Estado: {estadoMesa}
        </div>
        <p className="text-slate-500 font-medium max-w-xs mb-8">
          Esta mesa ya se encuentra siendo atendida o está reservada. Por favor, solicita ayuda a un mesero o escanea otro QR.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button 
            onClick={() => {
              Swal.fire('¡Aviso Enviado!', 'Un mesero se acercará a tu mesa en breve.', 'success');
              // Aquí podrías disparar un fetch a tu API de notificaciones
            }}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            Llamar al Mesero
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="text-slate-400 text-xs font-bold uppercase hover:text-slate-600 transition-colors"
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
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Mesa #{mesaId}</p>
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
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{prod.descripcion}</p>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-black text-blue-600 italic">S/ {Number(prod.precio).toFixed(2)}</span>
                <button 
                  onClick={() => agregarAlCarrito(prod)}
                  className="bg-blue-600 text-white p-2 rounded-xl hover:scale-110 transition-transform shadow-lg shadow-blue-100"
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
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                Tu Pedido <span>{carrito.length} ítems</span>
            </h4>
            
            {/* Lista de productos seleccionados */}
            <div className="max-h-40 overflow-y-auto mb-6 space-y-3 pr-2 custom-scrollbar">
                {carrito.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                    <div className="flex items-center gap-3">
                    <span className="bg-blue-600 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full">
                        {item.cantidad}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{item.nombre}</span>
                    </div>
                    <span className="text-sm font-black text-slate-400">
                    S/ {(item.precio * item.cantidad).toFixed(2)}
                    </span>
                </div>
                ))}
            </div>

            {/* Botón de Envío */}
            <button 
                onClick={enviarPedido}
                className="w-full bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex justify-between items-center hover:bg-blue-600 transition-all active:scale-95"
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
    </div>
  );
}