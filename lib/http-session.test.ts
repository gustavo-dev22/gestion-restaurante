import { beforeEach, describe, expect, it, vi } from "vitest";

describe("http sin sesión local", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
  });

  it("bloquea la petición y notifica la expiración si falta el estado local", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchMock);

    const { useAuthStore } = await import("./store");
    useAuthStore.setState({ isAuthenticated: true, hasHydrated: true });
    localStorage.removeItem("gr-auth-storage");

    const { http } = await import("./http");

    await expect(http.get("/api/test")).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
