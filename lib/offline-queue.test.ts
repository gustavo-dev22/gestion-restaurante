import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./http";
import {
  enqueueRequest,
  flushOfflineQueue,
  getQueue,
  isOfflineError,
  removeQueuedRequest,
} from "./offline-queue";

function mockResponse(status: number, body: unknown = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("offline queue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("encola, lista y elimina solicitudes", () => {
    const item = enqueueRequest({
      url: "/api/mesero/pedido/detalle",
      method: "POST",
      body: { pedidoId: 1, items: [] },
    });

    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].id).toBe(item.id);

    removeQueuedRequest(item.id);
    expect(getQueue()).toHaveLength(0);
  });

  it("sincroniza, envía la clave de idempotencia y elimina al recibir 2xx", async () => {
    enqueueRequest({
      url: "/api/test",
      method: "POST",
      body: { ok: true },
      idempotencyKey: "test-key-123",
    });
    const fetchMock = vi.fn(() => mockResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushOfflineQueue();

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(getQueue()).toHaveLength(0);

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0][1];
    expect((init.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("test-key-123");
  });

  it("descarta errores de negocio (409) y conserva errores 5xx", async () => {
    enqueueRequest({ url: "/api/test", method: "POST", body: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => mockResponse(409, { message: "Stock insuficiente" }))
    );

    const business = await flushOfflineQueue();
    expect(business.failed).toBe(1);
    expect(business.errors[0]).toContain("Stock insuficiente");
    expect(getQueue()).toHaveLength(0);

    enqueueRequest({ url: "/api/test", method: "POST", body: {} });
    vi.stubGlobal("fetch", vi.fn(() => mockResponse(500)));

    const server = await flushOfflineQueue();
    expect(server.failed).toBe(1);
    expect(getQueue()).toHaveLength(1);
  });

  it("conserva la solicitud ante errores de red", async () => {
    enqueueRequest({ url: "/api/test", method: "POST", body: {} });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    );

    const result = await flushOfflineQueue();

    expect(result.failed).toBe(1);
    expect(getQueue()).toHaveLength(1);
  });

  it("detecta errores offline", () => {
    expect(isOfflineError(new HttpError("Red", 0))).toBe(true);
    expect(isOfflineError(new HttpError("Bad request", 400))).toBe(false);
  });
});
