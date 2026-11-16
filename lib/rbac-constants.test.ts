import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  mapSasiRoleToLocal,
} from "./rbac-constants";

function role(codigo: string) {
  return ROLE_DEFINITIONS.find((item) => item.codigo === codigo);
}

describe("rbac-constants", () => {
  it("mapea los roles SASI a roles locales", () => {
    expect(mapSasiRoleToLocal("Administrador")).toBe("ADMIN");
    expect(mapSasiRoleToLocal("Supervisor")).toBe("SUPERVISOR");
    expect(mapSasiRoleToLocal("Cajero")).toBe("CAJERO");
    expect(mapSasiRoleToLocal("Mesero")).toBe("MESERO");
    expect(mapSasiRoleToLocal("Cocina / Bar")).toBe("COCINA");
    expect(mapSasiRoleToLocal("Auditor")).toBe("AUDITOR");
    expect(mapSasiRoleToLocal("Cliente")).toBeNull();
  });

  it("el Administrador conserva todos los permisos", () => {
    const admin = role("ADMIN");
    expect(admin?.permisos).toHaveLength(PERMISSIONS.length);
    expect(admin?.permisos).toContain("roles:manage");
    expect(admin?.permisos).toContain("payments:refund");
  });

  it("el Supervisor no administra roles ni exporta auditoría", () => {
    const supervisor = role("SUPERVISOR");
    expect(supervisor?.permisos).toContain("audit:read");
    expect(supervisor?.permisos).not.toContain("audit:export");
    expect(supervisor?.permisos).not.toContain("roles:manage");
    expect(supervisor?.permisos).toContain("payments:refund");
  });

  it("el Auditor solo consulta y exporta", () => {
    const auditor = role("AUDITOR");
    expect(auditor?.permisos).toEqual(
      expect.arrayContaining(["audit:read", "audit:export"])
    );
    expect(auditor?.permisos).not.toContain("payments:refund");
    expect(auditor?.permisos).not.toContain("caja:close");
  });
});
