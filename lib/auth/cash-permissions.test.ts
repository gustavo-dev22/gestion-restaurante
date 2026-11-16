import { describe, expect, it } from "vitest";
import {
  CASH_PATHS,
  getCashPermissions,
  hasCashPermission,
  normalizeCashPath,
} from "./cash-permissions";
import type { AuthUserLike } from "@/lib/roles";

function usuarioCajero(): AuthUserLike {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    nombreCompleto: "Cajero Test",
    sistemas: [
      {
        id: 13,
        activo: true,
        roles: [
          {
            idRol: 1,
            nombreRol: "Cajero",
            esPrincipal: true,
            activo: true,
            objetos: [
              {
                idObjeto: 1,
                nombre: "Turno Actual",
                url: "/caja",
                acciones: ["LISTAR", "CREAR", "EDITAR", "EXPORTAR"],
              },
              {
                idObjeto: 2,
                nombre: "Movimientos",
                url: "/caja/movimientos",
                acciones: ["LISTAR", "CREAR"],
              },
              {
                idObjeto: 3,
                nombre: "Historial de Caja",
                url: "/caja/historial",
                acciones: ["LISTAR", "EXPORTAR"],
              },
            ],
          },
          {
            idRol: 2,
            nombreRol: "Inactivo",
            activo: false,
            objetos: [
              {
                idObjeto: 4,
                nombre: "Caja inactiva",
                url: "/caja",
                acciones: ["LISTAR"],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("cash-permissions", () => {
  it("extrae las acciones de los objetos de caja", () => {
    const permissions = getCashPermissions(usuarioCajero());

    expect(permissions[CASH_PATHS.turno]).toEqual(
      expect.arrayContaining(["LISTAR", "CREAR", "EDITAR", "EXPORTAR"])
    );
    expect(permissions[CASH_PATHS.movimientos]).toEqual(
      expect.arrayContaining(["LISTAR", "CREAR"])
    );
    expect(permissions[CASH_PATHS.historial]).toEqual(
      expect.arrayContaining(["LISTAR", "EXPORTAR"])
    );
  });

  it("valida permisos por ruta y acción", () => {
    const permissions = getCashPermissions(usuarioCajero());
    const session = { cashPermissions: permissions };

    expect(hasCashPermission(session, "/caja", "EDITAR")).toBe(true);
    expect(hasCashPermission(session, "/caja/", "EXPORTAR")).toBe(true);
    expect(hasCashPermission(session, "/caja/movimientos", "CREAR")).toBe(true);
    expect(hasCashPermission(session, CASH_PATHS.movimientos, "EDITAR")).toBe(false);
    expect(hasCashPermission(session, "/otra", "LISTAR")).toBe(false);
    expect(hasCashPermission({}, "/caja", "LISTAR")).toBe(false);
    expect(hasCashPermission(null, "/caja", "LISTAR")).toBe(false);
  });

  it("normaliza rutas de caja", () => {
    expect(normalizeCashPath("/caja/")).toBe("/caja");
    expect(normalizeCashPath("caja")).toBe("/caja");
    expect(normalizeCashPath("#")).toBeNull();
    expect(normalizeCashPath("/otra")).toBeNull();
  });
});
