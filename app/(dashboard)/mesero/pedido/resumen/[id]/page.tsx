// app/(dashboard)/mesero/pedido/resumen/[id]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Receipt } from 'lucide-react';
import Swal from 'sweetalert2';

export default function ResumenPedido() {
  const params = useParams();
  const router = useRouter();
  const [pedido, setPedido] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/mesero/pedido/resumen?id=${params.id}`)
      .then(res => res.json())
      .then(data => setPedido(data));
  }, [params.id]);

  const handleCancelarApertura = async () => {
    const result = await Swal.fire({
      title: '¿Anular apertura?',
      text: "La mesa volverá a estar disponible.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, liberar mesa',
      confirmButtonColor: '#64748b',
      allowEscapeKey: false,
      allowOutsideClick: false
    });

    if (result.isConfirmed) {
      const res = await fetch(`/api/mesero/pedido/cancelar?id=${params.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/mesero/salon');
      } else {
        Swal.fire('Error', 'No se puede cancelar si ya hay platos enviados.', 'error');
      }
    }
  };

  const handlePagarCuenta = async () => {
    // 1. Selección del método de pago
    const { value: metodo } = await Swal.fire({
      title: 'Finalizar Pedido',
      text: `Total a cobrar: S/ ${Number(pedido.total).toFixed(2)}`,
      icon: 'info',
      input: 'select',
      inputOptions: {
        'Efectivo': 'Efectivo',
        'Tarjeta': 'Tarjeta / POS',
        'Yape/Plin': 'Yape / Plin'
      },
      inputPlaceholder: 'Selecciona método de pago',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Pago',
      confirmButtonColor: '#10b981',
      cancelButtonText: 'Cancelar',
      allowEscapeKey: false,
      allowOutsideClick: false,
      inputValidator: (value) => {
        if (!value) return 'Debes seleccionar un método';
      }
    });

    if (metodo) {
      Swal.fire({ title: 'Procesando pago...', didOpen: () => Swal.showLoading() });

      const res = await fetch('/api/mesero/pedido/pagar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedidoId: params.id,
          metodoPago: metodo
        })
      });

      const data = await res.json();

      if (res.ok) {
        await Swal.fire({
          title: '¡Venta Exitosa!',
          text: 'La mesa ha sido liberada.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        router.push('/mesero/salon'); // Regresamos al salón de mesas verdes
      } else {
        if (data.error === 'COCINA_PENDIENTE') {
          Swal.fire({
            title: '¡Espera!',
            text: data.message,
            icon: 'warning',
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Entendido',
            allowEscapeKey: false,
            allowOutsideClick: false
          });
        } else {
          Swal.fire('Error', 'No se pudo procesar el pago.', 'error');
        }
      }
    }
  };

  if (!pedido) return <p>Cargando...</p>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/mesero/salon')} className="p-2 bg-white rounded-full shadow-sm"><ChevronLeft/></button>
        <h1 className="text-2xl font-bold">Resumen {pedido.mesa.numero}</h1>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border p-6 mb-6">
        <h2 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-widest">Consumo Actual</h2>
        <div className="space-y-4">
          {pedido.detalles.map((det: any) => (
            <div key={det.id} className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800">{det.producto.nombre}</p>
                  {/* Badge de estado del plato */}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    det.estado === 'Listo' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {det.estado}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{det.cantidad} x S/ {Number(det.precio_unitario).toFixed(2)}</p>
              </div>
              <span className="font-bold text-slate-700">S/ {Number(det.precio_unitario * det.cantidad).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div className="border-t mt-6 pt-6 flex justify-between items-end">
          <span className="text-slate-500 font-medium">Total a Pagar</span>
          <span className="text-3xl font-black text-blue-600">S/ {Number(pedido.total).toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          {pedido.detalles.length === 0 && (
            <button 
              onClick={handleCancelarApertura}
              className="w-full mt-4 text-slate-400 text-sm hover:text-red-500 transition-colors underline">
              Anular apertura de mesa
            </button>
          )}
         <button 
           onClick={() => router.push(`/mesero/pedido/${params.id}`)}
           className="flex items-center justify-center gap-2 bg-slate-800 text-white p-4 rounded-2xl font-bold">
           <Plus size={20}/> Agregar más
         </button>
         <button onClick={handlePagarCuenta} className="flex items-center justify-center gap-2 bg-emerald-600 text-white p-4 rounded-2xl font-bold">
           <Receipt size={20}/> Pagar Cuenta
         </button>
      </div>
    </div>
  );
}