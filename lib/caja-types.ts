export const METODOS_PAGO = ["Efectivo", "Tarjeta", "Yape/Plin"] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const MOVIMIENTOS_CAJA = ["Retiro", "Gasto", "Ingreso"] as const;
export type TipoMovimientoCaja = (typeof MOVIMIENTOS_CAJA)[number];

export const TIPOS_DESCUENTO = ["Porcentaje", "Monto"] as const;
export type TipoDescuento = (typeof TIPOS_DESCUENTO)[number];

export function esMetodoPago(value: unknown): value is MetodoPago {
  return typeof value === "string" && (METODOS_PAGO as readonly string[]).includes(value);
}

export function esTipoMovimientoCaja(value: unknown): value is TipoMovimientoCaja {
  return typeof value === "string" && (MOVIMIENTOS_CAJA as readonly string[]).includes(value);
}

export function esTipoDescuento(value: unknown): value is TipoDescuento {
  return typeof value === "string" && (TIPOS_DESCUENTO as readonly string[]).includes(value);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calcularDescuento(
  tipo: TipoDescuento,
  valor: number,
  subtotal: number
): number {
  const base = Math.max(0, Number(subtotal) || 0);
  const v = Math.max(0, Number(valor) || 0);
  const monto = tipo === "Porcentaje" ? (base * v) / 100 : v;
  return roundMoney(Math.min(base, monto));
}

export function calcularMontoItem(
  precio: number,
  cantidad: number,
  subtotal: number,
  descuentoTotal: number
): number {
  if (subtotal <= 0) return 0;
  const factor = Math.max(0, subtotal - descuentoTotal) / subtotal;
  return roundMoney(Number(precio) * Number(cantidad) * factor);
}

export interface PagoCalculo {
  metodo: string;
  monto: number;
  propina?: number;
}

export interface MovimientoCalculo {
  tipo: string;
  monto: number;
}

export interface DevolucionCalculo {
  metodo: string;
  monto: number;
  propina?: number;
}

export interface TotalesCaja {
  totalEfectivo: number;
  totalTarjeta: number;
  totalBilleteras: number;
  totalOtros: number;
  totalVentas: number;
  totalPropinas: number;
  totalDevoluciones: number;
  totalCobrado: number;
  totalIngresos: number;
  totalRetiros: number;
  totalGastos: number;
  efectivoEsperado: number;
}

export function calcularTotalesCaja(
  pagos: PagoCalculo[],
  movimientos: MovimientoCalculo[],
  fondoInicial: number,
  devoluciones: DevolucionCalculo[] = []
): TotalesCaja {
  let totalEfectivo = 0;
  let totalTarjeta = 0;
  let totalBilleteras = 0;
  let totalOtros = 0;
  let totalVentas = 0;
  let totalPropinas = 0;

  for (const pago of pagos) {
    const monto = Number(pago.monto) || 0;
    const propina = Number(pago.propina) || 0;
    const cobrado = monto + propina;

    totalVentas += monto;
    totalPropinas += propina;

    switch (pago.metodo) {
      case "Efectivo":
        totalEfectivo += cobrado;
        break;
      case "Tarjeta":
        totalTarjeta += cobrado;
        break;
      case "Yape/Plin":
        totalBilleteras += cobrado;
        break;
      default:
        totalOtros += cobrado;
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

  let totalDevoluciones = 0;
  let devolucionesEfectivo = 0;

  for (const devolucion of devoluciones) {
    const monto = Number(devolucion.monto) || 0;
    const propina = Number(devolucion.propina) || 0;
    totalDevoluciones += monto + propina;
    if (devolucion.metodo === "Efectivo") devolucionesEfectivo += monto + propina;
  }

  const totalCobrado = totalVentas + totalPropinas - totalDevoluciones;
  const efectivoEsperado =
    Number(fondoInicial) +
    totalEfectivo +
    totalIngresos -
    totalRetiros -
    totalGastos -
    devolucionesEfectivo;

  return {
    totalEfectivo: roundMoney(totalEfectivo),
    totalTarjeta: roundMoney(totalTarjeta),
    totalBilleteras: roundMoney(totalBilleteras),
    totalOtros: roundMoney(totalOtros),
    totalVentas: roundMoney(totalVentas),
    totalPropinas: roundMoney(totalPropinas),
    totalDevoluciones: roundMoney(totalDevoluciones),
    totalCobrado: roundMoney(totalCobrado),
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
  totalPropinas: number;
  totalDescuentos: number;
  totalDevoluciones: number;
  totalCobrado: number;
  totalIngresos: number;
  totalRetiros: number;
  totalGastos: number;
  efectivoEsperado: number | null;
  efectivoContado: number | null;
  diferencia: number | null;
  justificacion: string | null;
  cerradoPorNombre: string | null;
}

export interface PagoAplicacionDto {
  pedidoDetalleId: number;
  cantidad: number;
  monto: number;
  productoNombre: string;
}

export interface PagoCajaDto {
  id: number;
  pedidoId: number;
  mesaNumero: string;
  meseroNombre: string | null;
  cajeroNombre: string | null;
  turnoId: number | null;
  metodo: string;
  monto: number;
  propina: number;
  referencia: string | null;
  codigoAutorizacion: string | null;
  terminal: string | null;
  montoRecibido: number | null;
  cambio: number | null;
  etiqueta: string | null;
  estado: string;
  createdAt: string;
  aplicaciones: PagoAplicacionDto[];
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

export interface DescuentoDto {
  tipo: string;
  valor: number;
  montoAplicado: number;
  motivo: string;
  autorizadoPorNombre: string | null;
  createdAt: string;
}

export interface DevolucionDetalleDto {
  productoId: number;
  productoNombre: string;
  cantidad: number;
  monto: number | null;
}

export interface DevolucionDto {
  id: number;
  pagoId: number | null;
  turnoId: number;
  metodo: string;
  monto: number;
  propina: number;
  motivo: string;
  autorizadoPorNombre: string | null;
  cajeroNombre: string;
  estado: string;
  reversionStock: boolean;
  createdAt: string;
  detalles: DevolucionDetalleDto[];
}

export interface ComprobanteDto {
  id: number;
  tipo: string;
  monto: number;
  estado: string;
  createdAt: string;
}

export interface TurnoCajaResumenDto {
  turno: TurnoCajaDto;
  resumen: TotalesCaja;
  pagos: PagoCajaDto[];
  movimientos: MovimientoCajaDto[];
  devoluciones: DevolucionDto[];
  pendientesConciliar: number;
  pendientesDevoluciones: number;
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
  totalPagado: number;
  saldo: number;
  estadoPago: string;
  createdAt: string;
  detalles: Array<{ nombre: string; cantidad: number }>;
}

export interface CuentaDetalleDto {
  id: number;
  productoId: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  cantidadPagada: number;
  cantidadPendiente: number;
  subtotal: number;
  estado: string | null;
}

export interface CuentaPedidoDto {
  pedido: {
    id: number;
    mesaNumero: string;
    meseroNombre: string | null;
    estado: string | null;
    estadoPago: string;
    subtotal: number;
    descuentoTotal: number;
    propinaTotal: number;
    total: number;
    totalPagado: number;
    saldo: number;
    createdAt: string;
    pagadoEn: string | null;
  };
  detalles: CuentaDetalleDto[];
  pagos: PagoCajaDto[];
  descuento: DescuentoDto | null;
  devoluciones: DevolucionDto[];
  comprobante: ComprobanteDto | null;
  esCuentaActual: boolean;
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
