export const METODOS_PAGO = ["Efectivo", "Tarjeta", "Yape/Plin"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const MOVIMIENTOS_CAJA = ["Retiro", "Gasto", "Ingreso"] as const;
export type TipoMovimientoCaja = (typeof MOVIMIENTOS_CAJA)[number];

export function esMetodoPago(value: unknown): value is MetodoPago {
  return typeof value === "string" && (METODOS_PAGO as readonly string[]).includes(value);
}

export function esTipoMovimientoCaja(value: unknown): value is TipoMovimientoCaja {
  return typeof value === "string" && (MOVIMIENTOS_CAJA as readonly string[]).includes(value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PagoCalculo {
  metodo: string;
  monto: number;
}

export interface MovimientoCalculo {
  tipo: string;
  monto: number;
}

export interface TotalesCaja {
  totalEfectivo: number;
  totalTarjeta: number;
  totalBilleteras: number;
  totalOtros: number;
  totalVentas: number;
  totalIngresos: number;
  totalRetiros: number;
  totalGastos: number;
  efectivoEsperado: number;
}

export function calcularTotalesCaja(
  pagos: PagoCalculo[],
  movimientos: MovimientoCalculo[],
  fondoInicial: number
): TotalesCaja {
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalBilleteras = 0;
  let totalOtros = 0;

  for (const pago of pagos) {
    const monto = Number(pago.monto) || 0;
    switch (pago.metodo) {
      case "Efectivo":
        totalEfectivo += monto;
        break;
      case "Tarjeta":
        totalTarjeta += monto;
        break;
      case "Yape/Plin":
        totalBilleteras += monto;
        break;
      default:
        totalOtros += monto;
        break;
    }
  }

  let totalIngresos = 0;
  let totalRetiros = 0;
  let totalGastos = 0;

  for (const movimiento of movimientos) {
    const monto = Number(movimiento.monto) || 0;
    if (movimiento.tipo === "Ingreso") totalIngresos += monto;
    else if (movimiento.tipo === "Retiro") totalRetiros += monto;
    else if (movimiento.tipo === "Gasto") totalGastos += monto;
  }

  const totalVentas = totalEfectivo + totalTarjeta + totalBilleteras + totalOtros;
  const efectivoEsperado =
    Number(fondoInicial) + totalEfectivo + totalIngresos - totalRetiros - totalGastos;

  return {
    totalEfectivo: roundMoney(totalEfectivo),
    totalTarjeta: roundMoney(totalTarjeta),
    totalBilleteras: roundMoney(totalBilleteras),
    totalOtros: roundMoney(totalOtros),
    totalVentas: roundMoney(totalVentas),
    totalIngresos: roundMoney(totalIngresos),
    totalRetiros: roundMoney(totalRetiros),
    totalGastos: roundMoney(totalGastos),
    efectivoEsperado: roundMoney(efectivoEsperado),
  };
}

export function calcularDiferencia(efectivoContado: number, efectivoEsperado: number): number {
  return roundMoney(Number(efectivoContado) - Number(efectivoEsperado));
}

export interface TurnoCajaDto {
  id: number;
  cajeroId: string;
  cajeroNombre: string;
  estado: string;
  abiertoEn: string;
  cerradoEn: string | null;
  fondoInicial: number;
  totalEfectivo: number;
  totalTarjeta: number;
  totalBilleteras: number;
  totalOtros: number;
  totalVentas: number;
  totalIngresos: number;
  totalRetiros: number;
  totalGastos: number;
  efectivoEsperado: number | null;
  efectivoContado: number | null;
  diferencia: number | null;
  justificacion: string | null;
  cerradoPorNombre: string | null;
}

export interface PagoCajaDto {
  id: number;
  pedidoId: number;
  mesaNumero: string;
  meseroNombre: string | null;
  cajeroNombre: string | null;
  metodo: string;
  monto: number;
  referencia: string | null;
  estado: string;
  createdAt: string;
}

export interface MovimientoCajaDto {
  id: number;
  tipo: string;
  monto: number;
  motivo: string;
  usuarioNombre: string;
  createdAt: string;
}

export interface CajaEventoDto {
  id: number;
  tipo: string;
  detalle: string | null;
  monto: number | null;
  usuarioNombre: string | null;
  createdAt: string;
}

export interface TurnoCajaResumenDto {
  turno: TurnoCajaDto;
  resumen: TotalesCaja;
  pagos: PagoCajaDto[];
  movimientos: MovimientoCajaDto[];
  pendientesConciliar: number;
}

export interface ReporteCajaDto extends TurnoCajaResumenDto {
  eventos: CajaEventoDto[];
}

export interface HistorialCajaDto {
  items: TurnoCajaDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PedidoPorCobrarDto {
  id: number;
  mesaNumero: string;
  meseroNombre: string | null;
  total: number;
  createdAt: string;
  detalles: Array<{ nombre: string; cantidad: number }>;
}

export interface CajaEstadoDto {
  abierta: boolean;
  turnoId: number | null;
  cajeroNombre: string | null;
  abiertoEn: string | null;
}

export interface CajaDashboardDto {
  abierta: boolean;
  turno: TurnoCajaResumenDto | null;
  ultimo: TurnoCajaDto | null;
}
