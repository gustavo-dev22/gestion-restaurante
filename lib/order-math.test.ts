import { describe, expect, it } from "vitest";
import { calcularTotalPedido, stockSuficiente } from "./order-math";

describe("calcularTotalPedido", () => {
  it("calcula el total usando precios del servidor", () => {
    const total = calcularTotalPedido([
      { precio: 26, cantidad: 2 },
      { precio: "24.50", cantidad: 1 },
    ]);

    expect(total).toBe(76.5);
  });

  it("devuelve 0 para un pedido vacío", () => {
    expect(calcularTotalPedido([])).toBe(0);
  });
});

describe("stockSuficiente", () => {
  it("permite productos sin control de stock", () => {
    expect(stockSuficiente(null, 100)).toBe(true);
    expect(stockSuficiente(undefined, 100)).toBe(true);
  });

  it("valida el stock disponible", () => {
    expect(stockSuficiente(5, 5)).toBe(true);
    expect(stockSuficiente(5, 6)).toBe(false);
    expect(stockSuficiente(0, 1)).toBe(false);
  });
});
