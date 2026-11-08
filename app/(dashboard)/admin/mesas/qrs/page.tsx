'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Loader2, QrCode } from 'lucide-react';

export default function GenerarQRPage() {
  const [mesas, setMesas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [origen, setOrigen] = useState('');

  useEffect(() => {
    fetch('/api/mesas')
      .then(res => res.json())
      .then(data => {
        setOrigen(window.location.origin);
        setMesas(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setMesas([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const imprimir = () => window.print();

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6">
      {/* Header - Se oculta al imprimir */}
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">Generador de QRs</h1>
          <p className="text-slate-500 font-medium">Imprime y coloca los códigos en cada mesa física</p>
        </div>
        <button 
          onClick={imprimir}
          className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold hover:bg-blue-600 transition-all shadow-lg"
        >
          <Printer size={20} /> Imprimir Etiquetas
        </button>
      </div>

      {/* Rejilla de QRs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {mesas.map((mesa) => (
          <div key={mesa.id} className="bg-white border-2 border-slate-200 rounded-[2.5rem] p-8 flex flex-col items-center text-center shadow-sm print:shadow-none print:border-slate-300">
            <div className="bg-slate-100 p-2 rounded-full mb-2">
                <QrCode size={16} className="text-slate-400" />
            </div>
            <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mb-1">Mesa Digital</span>
            <h2 className="text-4xl font-black text-slate-800 mb-6">{mesa.numero}</h2>
            
            <div className="bg-white p-4 rounded-3xl border-4 border-slate-50 mb-6 shadow-inner">
              {origen ? (
                <QRCodeSVG 
                  // Esta URL es la que el cliente visitará
                  value={`${origen}/cliente/mesa/${mesa.id}`}
                  size={160}
                  level={"H"}
                  includeMargin={false}
                />
              ) : (
                <div className="size-[160px] flex items-center justify-center text-slate-300">
                  <QrCode size={48} />
                </div>
              )}
            </div>
            
            <p className="text-[9px] text-slate-300 font-mono mb-4">ID_REF: {mesa.id}</p>
            <div className="w-full pt-4 border-t border-dashed border-slate-100">
                <p className="text-xs font-bold text-slate-400 italic">Escanea para ver la carta</p>
            </div>
          </div>
        ))}
      </div>

      {/* Estilos para impresión */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          nav, aside, header { display: none !important; } /* Oculta menús de SASI */
          main { margin: 0 !important; padding: 0 !important; }
          .grid { 
            display: grid !important; 
            grid-template-columns: repeat(2, 1fr) !important; 
            gap: 20px !important;
          }
          .bg-white { 
            page-break-inside: avoid; 
            border: 2px solid #e2e8f0 !important;
          }
        }
      `}</style>
    </div>
  );
}