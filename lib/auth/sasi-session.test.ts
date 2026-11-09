import { describe, expect, it } from "vitest";
import { buildLocalSession, getRestaurantUser } from "./sasi-session";
import type { AuthUserLike } from "@/lib/roles";

function usuarioMesero(): AuthUserLike {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    nombreCompleto: "Ana Mesera",
    sistemas: [
      {
        id: 13,
        activo: true,
        roles: [
          {
            nombreRol: "Mesero",
            esPrincipal: true,
            objetos: [
              { idObjeto: 1, nombre: "Salón", url: "/mesero/salon", tipo: "Menu" },
            ],
          },
        ],
      },
    ],
  };
}

describe("sasi-session", () => {
  it("acepta usuarios con acceso activo al sistema 13", () => {
    expect(getRestaurantUser({ usuario: usuarioMesero() })).not.toBeNull();
  });

  it("rechaza usuarios sin el sistema 13 o con acceso inactivo", () => {
    expect(getRestaurantUser({ usuario: { id: "x", sistemas: [{ id: 23, activo: true }] } })).toBeNull();

    const inactivo = usuarioMesero();
    inactivo.sistemas![0] = { ...inactivo.sistemas![0], activo: false };
    expect(getRestaurantUser({ usuario: inactivo })).toBeNull();
  });

  it("construye la sesión local con home, rol y secciones", () => {
    const session = buildLocalSession(usuarioMesero());

    expect(session).not.toBeNull();
    expect(session?.sub).toBe("11111111-1111-1111-1111-111111111111");
    expect(session?.nombre).toBe("Ana Mesera");
    expect(session?.rol).toBe("Mesero");
    expect(session?.home).toBe("/mesero/salon");
    expect(session?.sections).toContain("mesero");
    expect(session?.authMethod).toBe("direct");
  });

  it("marca la sesión como SSO cuando se solicita", () => {
    const session = buildLocalSession(usuarioMesero(), "sso");
    expect(session?.authMethod).toBe("sso");
  });

  it("rechaza usuarios sin identificador", () => {
    const sinId = usuarioMesero();
    sinId.id = "";
    expect(buildLocalSession(sinId)).toBeNull();
  });
});
