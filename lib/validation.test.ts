import { describe, expect, it } from "vitest";
import { validateLogin } from "./validation";

describe("validateLogin", () => {
  it("exige usuario y contraseña", () => {
    const errors = validateLogin({ username: "  ", password: "" });
    expect(errors.username).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  it("no devuelve errores con datos válidos", () => {
    const errors = validateLogin({ username: "mesero", password: "secreto" });
    expect(Object.keys(errors)).toHaveLength(0);
  });
});
