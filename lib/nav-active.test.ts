import { describe, expect, it } from "vitest";
import { isNavActive } from "./nav-active";

describe("isNavActive", () => {
  it("marca un submenú solo cuando la ruta coincide exactamente", () => {
    expect(isNavActive("/caja/movimientos", "/caja", true)).toBe(false);
    expect(isNavActive("/caja/movimientos", "/caja/movimientos", true)).toBe(true);
    expect(isNavActive("/caja/historial", "/caja/historial", true)).toBe(true);
    expect(isNavActive("/caja", "/caja", true)).toBe(true);
  });

  it("mantiene el menú padre activo para rutas hijas", () => {
    expect(isNavActive("/caja/movimientos", "/caja")).toBe(true);
    expect(isNavActive("/caja/historial", "/caja")).toBe(true);
    expect(isNavActive("/otra", "/caja")).toBe(false);
  });

  it("ignora enlaces vacíos y anclas", () => {
    expect(isNavActive("/caja", "#")).toBe(false);
    expect(isNavActive("/caja", null)).toBe(false);
  });
});
