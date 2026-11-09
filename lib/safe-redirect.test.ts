import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it("acepta rutas internas", () => {
    expect(getSafeRedirect("/admin/mesas")).toBe("/admin/mesas");
    expect(getSafeRedirect("/login?redirect=%2Fadmin")).toBe(
      "/login?redirect=%2Fadmin"
    );
  });

  it("rechaza redirecciones abiertas o externas", () => {
    expect(getSafeRedirect("//evil.com")).toBeNull();
    expect(getSafeRedirect("https://evil.com")).toBeNull();
    expect(getSafeRedirect("javascript:alert(1)")).toBeNull();
    expect(getSafeRedirect("/\\evil.com")).toBeNull();
    expect(getSafeRedirect("")).toBeNull();
    expect(getSafeRedirect(null)).toBeNull();
  });
});
