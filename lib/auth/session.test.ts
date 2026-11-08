import { afterEach, describe, expect, it, vi } from "vitest";
import { isSessionCookieSecure } from "./session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSessionCookieSecure", () => {
  it("permite desactivar secure para LAN HTTP", () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    expect(isSessionCookieSecure()).toBe(false);
  });

  it("permite forzar secure con HTTPS", () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    expect(isSessionCookieSecure()).toBe(true);
  });

  it("por defecto no usa secure fuera de producción", () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "");
    expect(isSessionCookieSecure()).toBe(false);
  });
});
