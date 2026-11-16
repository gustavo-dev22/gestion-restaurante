"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { toastSuccess } from "@/components/ui/Toast";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import {
  calcularDiferencia,
  type TurnoCajaResumenDto,
} from "@/lib/caja-types";
import { getErrorMessage, http } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { can } from "./can";

interface CierrePanelProps {
  turnoData: TurnoCajaResumenDto | null;
  permissions: CashPermissions;
  onRefresh: () => Promise<void>;
  onClosed: (turnoId: number) => void;
}

export function CierrePanel({
  turnoData,
  permissions,
  onRefresh,
  onClosed,
}: CierrePanelProps) {
  const [contado, setContado] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turno = turnoData?.turno ?? null;
  const abierto = turno?.estado === "Abierto";
  const puedeEditar = can(permissions, CASH_PATHS.turno, "EDITAR");
  const resumen = turnoData?.resumen;
  const esperado = resumen?.efectivoEsperado ?? 0;
  const pendientes = turnoData?.pendientesConciliar ?? 0;
  const pendientesDevoluciones = turnoData?.pendientesDevoluciones ?? 0;
  const contadoNumero = Number(contado);
  const diferencia =
    contado.trim() === "" || !Number.isFinite(contadoNumero)
      ? null
      : calcularDiferencia(contadoNumero, esperado);
  const requiereJustificacion =
    diferencia !== null && Math.abs(diferencia) >= 0.01;
  const puedeCerrar =
    Boolean(turno) &&
    abierto &&
    puedeEditar &&
    pendientes === 0 &&
    pendientesDevoluciones === 0 &&
    contado.trim() !== "" &&
    Number.isFinite(contadoNumero) &&
    contadoNumero >= 0 &&
    (!requiereJustificacion || justificacion.trim().length > 0);

  const abrirConfirmacion = () => {
    setError(null);
    if (!puedeCerrar) {
      setError(
        pendientes > 0 || pendientesDevoluciones > 0
          ? "Conciliación pendiente: no puedes cerrar el turno todavía."
          : "Completa el efectivo contado y la justificación si hay diferencia."
      );
      return;
    }
    setConfirmOpen(true);
  };

  const cerrar = async () => {
    if (!turno) return;
    setClosing(true);
    setError(null);
    try {
      await http.post(`/api/caja/turnos/${turno.id}/cerrar`, {
        efectivoContado: contadoNumero,
        justificacion: justificacion.trim(),
      });
      setConfirmOpen(false);
      toastSuccess("Caja cerrada", "El reporte de cierre está listo.");
      await onRefresh();
      onClosed(turno.id);
    } catch (err) {
      setConfirmOpen(false);
      setError(getErrorMessage(err, "No se pudo cerrar el turno."));
    } finally {
      setClosing(false);
    }
  };

  if (!turno || !abierto) {
    return (
      <Card className="p-6">
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
          No hay un turno abierto para cerrar.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-800">Arqueo de caja</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cuenta el efectivo físico y compáralo con el esperado por el sistema.
        </p>

        <dl className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">Fondo inicial</dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(turno.fondoInicial)}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">Ventas en efectivo</dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(resumen?.totalEfectivo ?? 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">Propinas</dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(resumen?.totalPropinas ?? 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">Devoluciones</dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(resumen?.totalDevoluciones ?? 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">Total cobrado</dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(resumen?.totalCobrado ?? 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
            <dt className="text-sm font-medium text-slate-600">
              Ingresos - retiros - gastos
            </dt>
            <dd className="font-bold text-slate-800">
              {formatCurrency(
                (resumen?.totalIngresos ?? 0) -
                  (resumen?.totalRetiros ?? 0) -
                  (resumen?.totalGastos ?? 0)
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3">
            <dt className="text-sm font-semibold text-blue-800">Efectivo esperado</dt>
            <dd className="text-xl font-black text-blue-800">
              {formatCurrency(esperado)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-slate-800">Cierre del turno</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cajero: {turno.cajeroNombre}
        </p>

        {(pendientes > 0 || pendientesDevoluciones > 0) && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
            Hay {pendientes} pago(s) y {pendientesDevoluciones} devolución(es)
            electrónica(s) pendiente(s) de conciliar. Concílialos antes de cerrar.
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="efectivo-contado" required>
              Efectivo contado
            </Label>
            <Input
              id="efectivo-contado"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={contado}
              onChange={(event) => {
                setContado(event.target.value);
                if (error) setError(null);
              }}
              disabled={!puedeEditar}
            />
          </div>

          <div
            className={`rounded-xl p-4 ${
              diferencia === null
                ? "bg-slate-50"
                : Math.abs(diferencia) < 0.01
                  ? "bg-emerald-50"
                  : "bg-rose-50"
            }`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Diferencia
            </p>
            <p
              className={`mt-1 text-2xl font-black ${
                diferencia === null
                  ? "text-slate-700"
                  : Math.abs(diferencia) < 0.01
                    ? "text-emerald-700"
                    : "text-rose-700"
              }`}
            >
              {diferencia === null ? "—" : formatCurrency(diferencia)}
            </p>
          </div>

          {requiereJustificacion && (
            <div>
              <Label htmlFor="justificacion" required>
                Justificación de la diferencia
              </Label>
              <Textarea
                id="justificacion"
                value={justificacion}
                onChange={(event) => setJustificacion(event.target.value)}
                placeholder="Explica el faltante o sobrante de efectivo."
                maxLength={500}
                disabled={!puedeEditar}
              />
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-rose-600">
              {error}
            </p>
          )}

          {!puedeEditar ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">
              No tienes permiso para cerrar el turno.
            </p>
          ) : (
            <Button
              className="w-full"
              variant="secondary"
              onClick={abrirConfirmacion}
              disabled={!puedeCerrar}
            >
              <Lock size={18} aria-hidden="true" />
              Cerrar turno
            </Button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={cerrar}
        title="¿Cerrar el turno?"
        description={`Esperado ${formatCurrency(esperado)}, contado ${formatCurrency(
          contadoNumero || 0
        )}, diferencia ${formatCurrency(diferencia ?? 0)}. Esta acción no se puede deshacer.`}
        confirmLabel="Sí, cerrar caja"
        variant="danger"
        loading={closing}
      />
    </div>
  );
}
