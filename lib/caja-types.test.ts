import { describe, expect, it } from "vitest";
import {
  calcularDescuento,
  calcularDiferencia,
  calcularMontoItem,
  calcularTotalesCaja,
  roundMoney,
} from "./caja-types";

describe("caja-types", () => {
  it("calcula totales por método y efectivo esperado", () => {
    const resumen = calcularTotalesCaja(
      [
        { metodo: "Efectivo", monto: 100 },
        { metodo: "Tarjeta", monto: 50 },
        { metodo: "Yape/Plin", monto: 25 },
        { metodo: "Otro", monto: 5 },
      ],
      [
        { tipo: "Ingreso", monto: 10 },
        { tipo: "Retiro", monto: 20 },
        { tipo: "Gasto", monto: 15 },
      ],
      100
    );

    expect(resumen).toEqual({
      totalEfectivo: 100,
      totalTarjeta: 50,
      totalBilleteras: 25,
      totalOtros: 5,
      totalVentas: 180,
      totalPropinas: 0,
      totalDevoluciones: 0,
      totalCobrado: 180,
      totalIngresos: 10,
      totalRetiros: 20,
      totalGastos: 15,
      efectivoEsperado: 175,
    });
  });

  it("incluye propinas y devoluciones en el cierre", () => {
    const resumen = calcularTotalesCaja(
      [
        { metodo: "Efectivo", monto: 100, propina: 10 },
        { metodo: "Tarjeta", monto: 50 },
      ],
      [{ tipo: "Gasto", monto: 15 }],
      100,
      [{ metodo: "Efectivo", monto: 20 }]
    );

    expect(resumen.totalEfectivo).toBe(110);
    expect(resumen.totalVentas).toBe(150);
    expect(resumen.totalPropinas).toBe(10);
    expect(resumen.totalDevoluciones).toBe(20);
    expect(resumen.totalCobrado).toBe(140);
    expect(resumen.efectivoEsperado).toBe(175);
  });

  it("calcula descuentos y montos por ítem con redondeo", () => {
    expect(calcularDescuento("Porcentaje", 10, 200)).toBe(20);
    expect(calcularDescuento("Monto", 20, 200)).toBe(20);
    expect(calcularDescuento("Monto", 500, 200)).toBe(200);
    expect(calcularMontoItem(25, 2, 200, 20)).toBe(45);
    expect(roundMoney(10.555)).toBe(10.56);
    expect(calcularDiferencia(175, 170)).toBe(5);
    expect(calcularDiferencia(169.99, 170)).toBe(-0.01);
  });
});
