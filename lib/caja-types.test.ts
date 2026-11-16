import { describe, expect, it } from "vitest";
import {
  calcularDiferencia,
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
      totalIngresos: 10,
      totalRetiros: 20,
      totalGastos: 15,
      efectivoEsperado: 175,
    });
  });

  it("redondea a dos decimales y calcula la diferencia", () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(calcularDiferencia(175, 170)).toBe(5);
    expect(calcularDiferencia(169.99, 170)).toBe(-0.01);
  });
});
