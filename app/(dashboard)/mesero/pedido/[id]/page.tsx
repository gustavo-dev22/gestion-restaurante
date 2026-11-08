'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ShoppingCart, Plus, Minus, ChevronLeft, 
  Loader2, Save, UtensilsCrossed 
} from 'lucide-react';
import Swal from 'sweetalert2';

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="h-full w-full rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
        <UtensilsCrossed size={28} />
      </div>
    );
  }

  return (
    <img
      src={src}
      className="h-full w-full rounded-xl object-cover"
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

export default function TomaPedidoPage() {
  const params = useParams();
  const router = useRouter();
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [carrito, setCarrito] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [yaTeniaItems, setYaTeniaItems] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resProd, resCat, resResumen] = await Promise.all([
          fetch('/api/productos'),
          fetch('/api/categorias'),
          fetch(`/api/mesero/pedido/resumen?id=${params.id}`)
        ]);
        setProductos(await resProd.json());
        setCategorias(await resCat.json());

        const datosPedido = await resResumen.json();
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

  const handleBack = async () => {
    // --- CASO A: EL PEDIDO YA ES REAL (Tiene items en DB) ---
    if (yaTeniaItems) {
      if (carrito.length > 0) {
        // Si el mesero añadió cosas nuevas al carrito pero no las envió
        const result = await Swal.fire({
          title: '¿Descartar cambios?',
          text: "Los nuevos platos en el carrito no se guardarán.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, salir',
          cancelButtonText: 'Seguir pidiendo',
          confirmButtonColor: '#ef4444',
        });
        if (result.isConfirmed) router.back();
      } else {
        // Si no hay nada nuevo en el carrito, simplemente regresa (a Mis Pedidos o Resumen)
        router.back();
      }
      return; // Finalizamos aquí para que no ejecute la lógica de liberación
    }

    // --- CASO B: EL PEDIDO ESTÁ VACÍO EN DB (Mesa recién abierta o con carrito pendiente) ---
    // No importa si el carrito tiene 0 o 10 platos, si NO se han enviado a cocina, 
    // salir debe dar la opción de LIBERAR la mesa para no dejar "pedidos fantasma".
    
    const result = await Swal.fire({
      title: '¿Anular apertura?',
      text: "No has enviado nada a cocina. ¿Deseas liberar la mesa y cancelar el pedido?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar mesa',
      cancelButtonText: 'No, seguir pidiendo',
      confirmButtonColor: '#64748b',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (result.isConfirmed) {
      // Esto borra el registro de 'Pedidos' y pone la Mesa en 'Libre'
      const res = await fetch(`/api/mesero/pedido/cancelar?id=${params.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/mesero/salon');
      }
    }
  };

  const agregarAlCarrito = (producto: any) => {
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

  const guardarComanda = async () => {
    if (carrito.length === 0) {
      return Swal.fire({
        title: 'Carrito vacío',
        text: 'Debes seleccionar al menos un producto.',
        icon: 'warning',
        confirmButtonColor: '#2563eb',
        allowEscapeKey: false,
        allowOutsideClick: false
      });
    }

    const confirm = await Swal.fire({
      title: '¿Enviar Comanda?',
      text: `Se registrarán ${carrito.length} tipos de platos en el pedido.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar a cocina',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Revisar',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (confirm.isConfirmed) {
      Swal.fire({ title: 'Procesando...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

      const res = await fetch('/api/mesero/pedido/detalle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: params.id,
          items: carrito
        })
      });

      if (res.ok) {
        Swal.fire({title: '¡Enviado!', text: 'La comanda ha sido procesada correctamente.', icon: 'success', allowEscapeKey: false, allowOutsideClick: false});
        router.push('/mesero/salon');
      } else {
        Swal.fire('Error', 'No se pudo registrar la comanda.', 'error');
      }
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
    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
      <Loader2 className="animate-spin" size={40} />
      <p>Cargando carta digital...</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
      
      {/* SECCIÓN IZQUIERDA: CARTA DE PRODUCTOS AGRUPADA */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-center gap-4 mb-8">
           <button 
             onClick={handleBack} 
             className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition-colors"
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
                  <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
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
                        <p className="text-xs text-slate-400 mb-2 line-clamp-2 leading-relaxed">
                          {prod.descripcion || 'Sin descripción disponible.'}
                        </p>
                        <div className="flex justify-between items-center">
                          <p className="font-black text-blue-600">S/ {Number(prod.precio).toFixed(2)}</p>
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

      {/* SECCIÓN DERECHA: RESUMEN / CARRITO */}
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col p-6 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-8 text-slate-800 border-b pb-4">
           <div className="p-2 bg-slate-100 rounded-lg">
             <ShoppingCart size={22} className="text-slate-600" />
           </div>
           <h2 className="text-xl font-bold">Comanda Actual</h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-40">
              <Plus size={48} className="mb-2" />
              <p className="text-center text-sm font-medium">Selecciona platos de la carta para empezar</p>
            </div>
          ) : (
            carrito.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-700 truncate">{item.nombre}</p>
                  <p className="text-xs text-blue-600 font-bold">S/ {Number(item.precio * item.cantidad).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); quitarDelCarrito(item.id); }} 
                    className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm"
                  >
                    <Minus size={14}/>
                  </button>
                  <span className="font-bold text-slate-700 w-6 text-center">{item.cantidad}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); agregarAlCarrito(item); }} 
                    className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
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
            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total Pedido</span>
            <span className="text-3xl font-black text-slate-800">S/ {total.toFixed(2)}</span>
          </div>
          <button 
            onClick={guardarComanda}
            disabled={carrito.length === 0}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all ${
              carrito.length === 0 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 active:scale-95'
            }`}
          >
            <Save size={20} /> Enviar a Cocina
          </button>
        </div>
      </div>
    </div>
  );
}