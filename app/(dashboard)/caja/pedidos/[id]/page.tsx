import { Card } from "@/components/ui/Card";
import { CuentaPedidoClient } from "@/components/caja/CuentaPedidoClient";
import { getServerSession } from "@/lib/auth/server-session";
import { getCajaEstado } from "@/lib/caja";
import {
  CASH_PATHS,
  hasAnyCashPermission,
} from "@/lib/auth/cash-permissions";

export const dynamic = "force-dynamic";

interface CuentaPageProps {
  params: Promise<{ id: string }>;
}

export default async function CuentaPedidoPage({ params }: CuentaPageProps) {
  const session = await getServerSession();

  if (!session?.cashPermissions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Permisos de caja desactualizados</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cierra sesión y vuelve a entrar para actualizar tus permisos.
          </p>
        </Card>
      </div>
    );
  }

  if (
    !hasAnyCashPermission(
      session,
      [CASH_PATHS.turno, CASH_PATHS.historial],
      "LISTAR"
    )
  ) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Acceso denegado</h1>
          <p className="mt-2 text-sm text-slate-600">
            No tienes permisos para consultar esta cuenta.
          </p>
        </Card>
      </div>
    );
  }

  const { id } = await params;
  const pedidoId = Number(id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="mx-auto max-w-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-slate-800">Pedido inválido</h1>
        </Card>
      </div>
    );
  }

  const caja = await getCajaEstado();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <CuentaPedidoClient
        pedidoId={pedidoId}
        turnoActivoId={caja.turnoId}
        permissions={session.cashPermissions}
      />
    </div>
  );
}
