import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { MovimientosPageClient } from "@/components/caja/MovimientosPageClient";
import { getServerSession } from "@/lib/auth/server-session";
import {
  CASH_PATHS,
  hasCashPermission,
} from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

export default async function MovimientosCajaPage() {
  const session = await getServerSession();

  if (!session?.cashPermissions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Permisos de caja desactualizados</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cierra sesión desde el menú y vuelve a iniciar sesión para actualizar tus permisos.
          </p>
        </Card>
      </div>
    );
  }

  const puedeVerMovimientos =
    hasCashPermission(session, CASH_PATHS.movimientos, "LISTAR") ||
    hasCashPermission(session, CASH_PATHS.movimientos, "CREAR");
  const puedeVerTurno = hasCashPermission(session, CASH_PATHS.turno, "LISTAR");

  if (!puedeVerMovimientos || !puedeVerTurno) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
          <p className="mt-2 text-sm text-slate-600">
            No tienes permisos para consultar los movimientos de caja.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Movimientos de caja"
        description="Retiros, gastos menores e ingresos del turno actual."
      />
      <MovimientosPageClient permissions={session.cashPermissions} />
    </div>
  );
}
