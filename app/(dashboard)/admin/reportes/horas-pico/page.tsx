import { Clock, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { getHorasPicoReportCached } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function HorasPicoPage() {
  const data = await getHorasPicoReportCached();
  const max = data.resumen.maxPedidos || 1;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Reporte de Horas Pico"
        description="Análisis de flujo de clientes por franja horaria"
      />

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl bg-blue-600 p-8 text-white shadow-xl shadow-blue-100">
          <div>
            <p className="mb-1 text-xs font-bold uppercase opacity-80">Hora de Mayor Demanda</p>
            <h3 className="text-4xl font-black italic">{data.resumen.horaMasFrecuente}</h3>
          </div>
          <Clock size={48} className="opacity-30" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-8 text-white shadow-xl">
          <div>
            <p className="mb-1 text-xs font-bold uppercase opacity-80">Pico de Pedidos</p>
            <h3 className="text-4xl font-black italic">{data.resumen.maxPedidos} Pedidos</h3>
          </div>
          <Users size={48} className="opacity-30" aria-hidden="true" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-8 flex items-center gap-2 text-xl font-bold text-slate-800">
          <TrendingUp size={20} className="text-blue-600" aria-hidden="true" /> Histograma de pedidos (24h)
        </h2>

        <figure>
          <div
            role="img"
            aria-label={`Histograma de pedidos por hora. La hora con más pedidos es ${data.resumen.horaMasFrecuente} con ${data.resumen.maxPedidos} pedidos.`}
            className="flex h-64 items-end justify-between gap-1"
          >
            {data.ventasPorHora.map((item, index) => {
              const altura = (item.cantidad / max) * 100;
              return (
                <div key={item.hora} className="group relative flex h-full flex-1 flex-col items-center">
                  <div className="absolute -top-10 z-20 hidden whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                    {item.cantidad} pedidos
                  </div>
                  <div className="flex h-full w-full items-end justify-center px-[1px]">
                    <div
                      style={{ height: item.cantidad > 0 ? `${Math.max(altura, 5)}%` : "2px" }}
                      className={`w-full rounded-t-sm transition-all duration-700 ${
                        item.cantidad > 0
                          ? item.hora === data.resumen.horaMasFrecuente
                            ? "bg-blue-600"
                            : "bg-blue-300"
                          : "bg-slate-100"
                      }`}
                    />
                  </div>
                  <span className="mt-2 text-xs font-medium text-slate-600">
                    {index % 3 === 0 ? item.hora : ""}
                  </span>
                </div>
              );
            })}
          </div>

          <figcaption className="sr-only">
            Datos equivalentes del histograma de pedidos por hora.
          </figcaption>
          <table className="sr-only">
            <caption>Pedidos y monto por hora</caption>
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Pedidos</th>
                <th scope="col">Monto total</th>
              </tr>
            </thead>
            <tbody>
              {data.ventasPorHora.map((item) => (
                <tr key={item.hora}>
                  <th scope="row">{item.hora}</th>
                  <td>{item.cantidad}</td>
                  <td>{item.montoTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </figure>
      </div>
    </div>
  );
}
