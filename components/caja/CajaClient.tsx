"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Banknote,
  CheckCircle2,
  History,
  Lock,
  Receipt,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { CASH_PATHS, type CashPermissions } from "@/lib/auth/cash-permissions";
import type { PedidoPorCobrarDto, TurnoCajaResumenDto } from "@/lib/caja-types";
import { can } from "./can";
import { TurnoPanel } from "./TurnoPanel";
import { MovimientosPanel } from "./MovimientosPanel";
import { ConciliacionPanel } from "./ConciliacionPanel";
import { CierrePanel } from "./CierrePanel";
import { CobrarPanel } from "./CobrarPanel";
import type { CajaTab } from "./types";

interface CajaClientProps {
  permissions: CashPermissions;
}

export function CajaClient({ permissions }: CajaClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<CajaTab>("turno");

  const {
    data: turnoData,
    error: turnoError,
    isLoading: turnoLoading,
    mutate: mutateTurno,
  } = useSWR<TurnoCajaResumenDto | null>("/api/caja/turno-activo");

  const {
    data: pedidos,
    isLoading: pedidosLoading,
    mutate: mutatePedidos,
  } = useSWR<PedidoPorCobrarDto[]>("/api/caja/pedidos-por-cobrar");

  const tabs = useMemo(
    () =>
      [
        { id: "turno" as const, label: "Turno", icon: Wallet, visible: true },
        {
          id: "movimientos" as const,
          label: "Movimientos",
          icon: Receipt,
          visible:
            can(permissions, CASH_PATHS.movimientos, "LISTAR") ||
            can(permissions, CASH_PATHS.movimientos, "CREAR"),
        },
        {
          id: "conciliacion" as const,
          label: "Conciliación",
          icon: CheckCircle2,
          visible:
            can(permissions, CASH_PATHS.turno, "LISTAR") ||
            can(permissions, CASH_PATHS.turno, "EDITAR"),
        },
        {
          id: "cierre" as const,
          label: "Cierre",
          icon: Lock,
          visible: can(permissions, CASH_PATHS.turno, "EDITAR"),
        },
        {
          id: "cobrar" as const,
          label: "Cobrar",
          icon: Banknote,
          visible:
            can(permissions, CASH_PATHS.turno, "LISTAR") ||
            can(permissions, CASH_PATHS.turno, "CREAR"),
        },
      ].filter((item) => item.visible),
    [permissions]
  );

  const activeTab =
    tabs.some((item) => item.id === tab) ? tab : "turno";

  const refresh = async () => {
    await Promise.all([mutateTurno(), mutatePedidos()]);
  };

  if (turnoLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28" />
          ))}
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (turnoError) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-bold text-slate-800">No se pudo cargar la caja</p>
        <p className="mt-1 text-sm text-slate-600">
          Revisa la conexión o vuelve a iniciar sesión para actualizar tus permisos.
        </p>
        <Button className="mt-5" onClick={() => refresh()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  const turno = turnoData?.turno ?? null;
  const turnoAbierto = turno?.estado === "Abierto";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Secciones de caja">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(item.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <Badge tone={turnoAbierto ? "emerald" : "amber"}>
            {turnoAbierto ? "Caja abierta" : "Caja cerrada"}
          </Badge>
          {can(permissions, CASH_PATHS.historial, "LISTAR") && (
            <Link
              href="/caja/historial"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <History size={17} aria-hidden="true" />
              Historial
            </Link>
          )}
        </div>
      </div>

      {activeTab === "turno" && (
        <TurnoPanel
          turnoData={turnoData ?? null}
          permissions={permissions}
          onRefresh={refresh}
          onTabChange={setTab}
        />
      )}

      {activeTab === "movimientos" && (
        <MovimientosPanel
          turnoData={turnoData ?? null}
          permissions={permissions}
          onRefresh={refresh}
        />
      )}

      {activeTab === "conciliacion" && (
        <ConciliacionPanel
          turnoData={turnoData ?? null}
          permissions={permissions}
          onRefresh={refresh}
        />
      )}

      {activeTab === "cierre" && (
        <CierrePanel
          turnoData={turnoData ?? null}
          permissions={permissions}
          onRefresh={refresh}
          onClosed={(id) => router.push(`/caja/turnos/${id}/reporte`)}
        />
      )}

      {activeTab === "cobrar" && (
        <CobrarPanel
          turnoData={turnoData ?? null}
          pedidos={pedidos ?? []}
          pedidosLoading={pedidosLoading}
          permissions={permissions}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
