"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CashPermissions } from "@/lib/auth/cash-permissions";
import type { TurnoCajaResumenDto } from "@/lib/caja-types";
import { MovimientosPanel } from "./MovimientosPanel";

interface MovimientosPageClientProps {
  permissions: CashPermissions;
}

export function MovimientosPageClient({ permissions }: MovimientosPageClientProps) {
  const { data, error, isLoading, mutate } = useSWR<TurnoCajaResumenDto | null>(
    "/api/caja/turno-activo"
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-bold text-slate-800">No se pudo cargar la caja</p>
        <p className="mt-1 text-sm text-slate-600">
          Revisa la conexión o vuelve a iniciar sesión para actualizar tus permisos.
        </p>
        <Button className="mt-5" onClick={() => mutate()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  return (
    <MovimientosPanel
      turnoData={data ?? null}
      permissions={permissions}
      onRefresh={async () => {
        await mutate();
      }}
    />
  );
}
