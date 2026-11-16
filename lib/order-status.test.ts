import { describe, expect, it } from "vitest";
import {
  canTransition,
  deriveOrderStatus,
  isOrderStatus,
  normalizeOrderStatus,
} from "./order-status";

describe("order-status", () => {
  it("valida transiciones permitidas", () => {
    expect(canTransition("BORRADOR", "CONFIRMADO")).toBe(true);
    expect(canTransition("CONFIRMADO", "EN_COCINA")).toBe(true);
    expect(canTransition("LISTO", "SERVIDO")).toBe(true);
    expect(canTransition("PAGADO", "CERRADO")).toBe(true);
    expect(canTransition("ANULADO", "PAGADO")).toBe(false);
    expect(canTransition("BORRADOR", "PAGADO")).toBe(false);
  });

  it("deriva el estado del pedido desde sus platos", () => {
    expect(deriveOrderStatus([])).toBe("CONFIRMADO");
    expect(deriveOrderStatus([{ estado: "PENDIENTE" }])).toBe("CONFIRMADO");
    expect(deriveOrderStatus([{ estado: "EN_PREPARACION" }])).toBe("EN_COCINA");
    expect(deriveOrderStatus([{ estado: "LISTO" }, { estado: "PENDIENTE" }])).toBe(
      "PARCIALMENTE_LISTO"
    );
    expect(deriveOrderStatus([{ estado: "LISTO" }, { estado: "LISTO" }])).toBe("LISTO");
    expect(deriveOrderStatus([{ estado: "SERVIDO" }, { estado: "SERVIDO" }])).toBe(
      "SERVIDO"
    );
  });

  it("normaliza estados históricos", () => {
    expect(normalizeOrderStatus("Por Confirmar")).toBe("BORRADOR");
    expect(normalizeOrderStatus("Pendiente")).toBe("CONFIRMADO");
    expect(normalizeOrderStatus("Pagado")).toBe("PAGADO");
    expect(normalizeOrderStatus("Expirado")).toBe("ANULADO");
    expect(normalizeOrderStatus("LISTO")).toBe("LISTO");
  });

  it("reconoce estados válidos", () => {
    expect(isOrderStatus("EN_COCINA")).toBe(true);
    expect(isOrderStatus("Pendiente")).toBe(false);
  });
});
