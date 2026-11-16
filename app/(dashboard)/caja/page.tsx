import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CajaClient } from "@/components/caja/CajaClient";
import { getServerSession } from "@/lib/auth/server-session";
import { CASH_PATHS, hasCashPermission } from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const session = await getServerSession();

  if (!session?.cashPermissions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Permisos de caja desactualizados</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tu sesión no tiene cargados los permisos de caja. Cierra sesión desde el menú
            y vuelve a iniciar sesión para actualizarlos.
          </p>
        </Card>
      </div>
    );
  }

  if (!hasCashPermission(session, CASH_PATHS.turno, "LISTAR")) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
          <p className="mt-2 text-sm text-slate-600">
            No tienes el permiso LISTAR para el módulo de caja.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Caja"
        description="Turno, cobros, conciliación y arqueo del efectivo."
      />
      <CajaClient permissions={session.cashPermissions} />
    </div>
  );
}
