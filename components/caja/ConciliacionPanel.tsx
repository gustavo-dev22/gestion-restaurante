"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { toastError, toastInfo, toastSuccess } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import type { TurnoCajaResumenDto } from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { can } from "./can";

interface ConciliacionPanelProps {
  turnoData: TurnoCajaResumenDto | null;
  permissions: CashPermissions;
  onRefresh: () => Promise<void>;
}

export function ConciliacionPanel({
  turnoData,
  permissions,
  onRefresh,
}: ConciliacionPanelProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedDevoluciones, setSelectedDevoluciones] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const turno = turnoData?.turno ?? null;
  const pagos = turnoData?.pagos ?? [];
  const devoluciones = turnoData?.devoluciones ?? [];
  const pendientes = pagos.filter(
    (pago) => pago.estado === "Registrado" && pago.metodo !== "Efectivo"
  );
  const pendientesDevoluciones = devoluciones.filter(
    (devolucion) =>
      devolucion.estado === "Registrada" && devolucion.metodo !== "Efectivo"
  );
  const puedeEditar = can(permissions, CASH_PATHS.turno, "EDITAR");

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleDevolucion = (id: number) => {
    setSelectedDevoluciones((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const conciliar = async () => {
    if (!turno) {
      toastError("Caja cerrada", "No hay un turno abierto.");
      return;
    }
    if (selected.length === 0 && selectedDevoluciones.length === 0) {
      toastInfo(
        "Sin selección",
        "Selecciona al menos un pago o devolución electrónica."
      );
      return;
    }

    setSaving(true);
    try {
      await http.patch(`/api/caja/turnos/${turno.id}/conciliar`, {
        pagoIds: selected,
        devolucionIds: selectedDevoluciones,
      });
      toastSuccess("Conciliación registrada", "Ya puedes cerrar el turno.");
      setSelected([]);
      setSelectedDevoluciones([]);
      await onRefresh();
    } catch (error) {
      toastError("No se pudo conciliar", getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!turno || turno.estado !== "Abierto") {
    return (
      <Card className="p-6">
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Abre un turno para revisar la conciliación de pagos.
        </p>
      </Card>
    );
  }

  if (pagos.length === 0 && devoluciones.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={CheckCircle2}
          title="Sin pagos en este turno"
          description="Los cobros aparecerán aquí para su conciliación."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Conciliación del turno</h2>
            <p className="mt-1 text-sm text-slate-600">
              Verifica los pagos electrónicos contra el reporte de la terminal.
              El efectivo se concilia con el conteo físico al cerrar.
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Pendientes electrónicos: {pendientes.length} pagos, {pendientesDevoluciones.length} devoluciones
            </p>
          </div>
          {puedeEditar && (
            <Button
              onClick={conciliar}
              loading={saving}
              disabled={selected.length === 0 && selectedDevoluciones.length === 0}
            >
              <CheckCircle2 size={18} aria-hidden="true" />
              Marcar seleccionados
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          {pagos.map((pago) => {
            const esEfectivo = pago.metodo === "Efectivo";
            const pendiente = pago.estado === "Registrado";
            const seleccionable = puedeEditar && !esEfectivo && pendiente;

            return (
              <div
                key={pago.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-3">
                  {seleccionable ? (
                    <input
                      type="checkbox"
                      checked={selected.includes(pago.id)}
                      onChange={() => toggle(pago.id)}
                      aria-label={`Conciliar pago de mesa ${pago.mesaNumero}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="h-4 w-4" aria-hidden="true" />
                  )}
                  <div>
                    <p className="font-semibold text-slate-800">
                      Mesa {pago.mesaNumero} · Pedido #{pago.pedidoId}
                    </p>
                    <p className="text-sm text-slate-600">
                      {pago.metodo} · {formatDateTime(pago.createdAt)}
                      {pago.referencia ? ` · Ref. ${pago.referencia}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    tone={
                      pago.estado === "Conciliado"
                        ? "emerald"
                        : esEfectivo
                          ? "blue"
                          : "amber"
                    }
                  >
                    {pago.estado === "Conciliado"
                      ? "Conciliado"
                      : esEfectivo
                        ? "Se concilia al cerrar"
                        : "Pendiente"}
                  </Badge>
                  <span className="font-bold text-slate-800">
                    {formatCurrency(pago.monto)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {devoluciones.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-800">Devoluciones</h2>
            <p className="text-sm text-slate-600">
              Las devoluciones electrónicas también deben conciliarse con la terminal.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {devoluciones.map((devolucion) => {
              const esEfectivo = devolucion.metodo === "Efectivo";
              const pendiente = devolucion.estado === "Registrada";
              const seleccionable = puedeEditar && !esEfectivo && pendiente;

              return (
                <div
                  key={devolucion.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    {seleccionable ? (
                      <input
                        type="checkbox"
                        checked={selectedDevoluciones.includes(devolucion.id)}
                        onChange={() => toggleDevolucion(devolucion.id)}
                        aria-label={`Conciliar devolución #${devolucion.id}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="h-4 w-4" aria-hidden="true" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-800">
                        Devolución #{devolucion.id} · {devolucion.metodo}
                      </p>
                      <p className="text-sm text-slate-600">
                        {devolucion.motivo} · {devolucion.cajeroNombre} ·{" "}
                        {formatDateTime(devolucion.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      tone={
                        devolucion.estado === "Conciliada"
                          ? "emerald"
                          : esEfectivo
                            ? "blue"
                            : "amber"
                      }
                    >
                      {devolucion.estado === "Conciliada"
                        ? "Conciliada"
                        : esEfectivo
                          ? "Se concilia al cerrar"
                          : "Pendiente"}
                    </Badge>
                    <span className="font-bold text-slate-800">
                      {formatCurrency(devolucion.monto + devolucion.propina)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
