import { describe, expect, it } from "vitest";
import { formatCurrency, parseLimaDateTime, peruStartOfDay, toLimaInputValue } from "./utils";

describe("formatCurrency", () => {
  it("formatea soles peruanos", () => {
    expect(formatCurrency(12.5)).toContain("S/");
    expect(formatCurrency(12.5)).toContain("12.50");
  });

  it("tolera valores nulos o inválidos", () => {
    expect(formatCurrency(null)).toContain("0.00");
    expect(formatCurrency("no-numero")).toContain("0.00");
  });
});

describe("parseLimaDateTime", () => {
  it("interpreta datetime-local como hora de Perú (UTC-5)", () => {
    const date = parseLimaDateTime("2026-11-08T15:30");
    expect(date?.toISOString()).toBe("2026-11-08T20:30:00.000Z");
  });

  it("respeta un offset o Z explícito", () => {
    const date = parseLimaDateTime("2026-11-08T20:30:00.000Z");
    expect(date?.toISOString()).toBe("2026-11-08T20:30:00.000Z");
  });

  it("devuelve null para valores inválidos", () => {
    expect(parseLimaDateTime("")).toBeNull();
    expect(parseLimaDateTime(null)).toBeNull();
  });
});

describe("toLimaInputValue", () => {
  it("convierte un instante UTC a datetime-local de Lima", () => {
    expect(toLimaInputValue(new Date("2026-11-08T20:30:00.000Z"))).toBe("2026-11-08T15:30");
  });
});

describe("peruStartOfDay", () => {
  it("calcula la medianoche de Perú como instante UTC", () => {
    const start = peruStartOfDay(0, new Date("2026-11-08T20:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-11-08T05:00:00.000Z");
  });
});
