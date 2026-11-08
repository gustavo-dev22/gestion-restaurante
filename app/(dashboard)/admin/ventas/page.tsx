'use client';
import { useEffect, useState } from 'react';
import { 
  Receipt, Calendar, User, DollarSign, 
  Search, Eye, FileText, Loader2 
} from 'lucide-react';
import Swal from 'sweetalert2';

export default function VentasPage() {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rango, setRango] = useState('hoy');

  useEffect(() => {
    const fetchConFiltro = async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/ventas?rango=${rango}`);
      const data = await res.json();
      setVentas(data);
      setLoading(false);
    };
    fetchConFiltro();
  }, [rango]);

  const verDetalle = (venta: any) => {
    const detallesHtml = venta.detalles.map((d: any) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;">
        <span>${d.cantidad} x ${d.producto.nombre}</span>
        <b>S/ ${(d.cantidad * d.precio_unitario).toFixed(2)}</b>
      </div>
    `).join('');

    Swal.fire({
      title: `Detalle de Venta #${venta.id}`,
      html: `
        <div style="text-align: left; border-top: 1px dashed #ccc; pt-4;">
          <p style="margin-bottom: 10px;"><b>Mesa:</b> ${venta.mesa.numero}</p>
          <p style="margin-bottom: 20px;"><b>Fecha:</b> ${new Date(venta.fecha_creacion).toLocaleString('es-PE', { timeZone: 'UTC' })}</p>
          ${detallesHtml}
          <div style="border-top: 2px solid #333; margin-top: 15px; padding-top: 10px; display: flex; justify-content: space-between; font-size: 18px;">
            <b>TOTAL:</b>
            <b style="color: #2563eb;">S/ ${Number(venta.total).toFixed(2)}</b>
          </div>
        </div>
      `,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#64748b',
      allowEscapeKey: false,
      allowOutsideClick: false
    });
  };

  const totalIngresos = ventas.reduce((acc, v) => acc + Number(v.total), 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Historial de Ventas</h1>
          <p className="text-slate-500 text-sm">Registro de todos los pedidos liquidados</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-right">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Total Ingresos</p>
          <p className="text-3xl font-black text-emerald-700">S/ {totalIngresos.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {['hoy', 'ayer', 'semana', 'mes'].map((f) => (
          <button
            key={f}
            onClick={() => setRango(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
              rango === f ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ticket</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Fecha y Hora</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Mesa</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Total</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin inline" /></td></tr>
            ) : ventas.length === 0 ? (
              <tr><td colSpan={5} className="py-20 text-center text-slate-400">No hay ventas registradas hoy.</td></tr>
            ) : (
              ventas.map((venta) => (
                <tr key={venta.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-blue-600">#00{venta.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(venta.fecha_creacion).toLocaleString('es-PE', { timeZone: 'UTC' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-600">
                      {venta.mesa.numero}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    S/ {Number(venta.total).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => verDetalle(venta)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}