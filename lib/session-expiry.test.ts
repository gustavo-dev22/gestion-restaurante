import { describe, expect, it, vi } from "vitest";
import { hasStoredSession, notifySessionExpired } from "./session-expiry";
import { useAuthStore } from "./store";

describe("session-expiry", () => {
  it("detecta si el estado de sesión local existe", () => {
    localStorage.clear();
    expect(hasStoredSession()).toBe(false);

    localStorage.setItem("gr-auth-storage", "{}");
    expect(hasStoredSession()).toBe(true);
  });

  it("limpia el estado local al notificar la expiración", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true } as Response))
    );
    localStorage.setItem("gr-auth-storage", "{}");
    useAuthStore.setState({ isAuthenticated: true });

    notifySessionExpired();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("gr-auth-storage")).toBeNull();
  });
});
