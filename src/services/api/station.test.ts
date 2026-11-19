import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { apiBaseUrl } from "./environment";
import { AxiosError, type AxiosAdapter } from "axios";
import { apiClient } from "./client";
import {
  contracts,
  fetchFile,
  formatLitres,
  formatMoney,
  idOf,
  operationPath,
  stationRequest,
  uploadFile,
  validate,
  type Schema,
} from "./station";
import { clearTokens, saveTokens } from "./tokens";
vi.mock("../../store", () => ({
  useAppStore: {
    getState: () => ({
      setSession: vi.fn((session: unknown) => {
        if (!session) clearTokens();
      }),
    }),
  },
}));
const ok = (data: unknown, config: Parameters<AxiosAdapter>[0]) => ({
  config,
  data: {
    success: true,
    message: "Done",
    data,
    meta: { page: 1, pages: 2, total: 21 },
  },
  status: 200,
  statusText: "OK",
  headers: {},
});
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  saveTokens({
    user: {
      _id: "OPR10006",
      name: "Test station",
      email: "station@example.test",
      role: "STATION",
      active: true,
      station: "STN10008",
    },
    accessToken: "station-access",
    refreshToken: "test-refresh",
    tokenType: "Bearer",
    expiresIn: 900,
    expiresAt: Date.now() + 900000,
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("station API integration", () => {
  it("registers every endpoint from collection folders 01, 08 and 09", () => {
    expect(
      Object.values(contracts).filter((item) => item.folder === "08"),
    ).toHaveLength(22);
    expect(
      Object.values(contracts).filter((item) => item.folder === "01"),
    ).toHaveLength(10);
    expect(
      Object.values(contracts).filter((item) => item.folder === "09"),
    ).toHaveLength(21);
    expect(
      new Set(Object.values(contracts).map((item) => item.method + item.path))
        .size,
    ).toBe(53);
    expect(
      Object.values(contracts)
        .filter((item) => item.folder === "08")
        .every((item) => item.path.startsWith("/station/")),
    ).toBe(true);
  });
  it("uses station-scoped paths and validates readable or internal IDs", () => {
    expect(
      operationPath("patchStationFuelPricesByFuelId", { fuelId: "FUL10001" }),
    ).toBe("/station/fuel-prices/FUL10001");
    expect(
      operationPath("getStationOrdersById", { id: "012345678901234567890123" }),
    ).toContain("012345678901234567890123");
    expect(() =>
      operationPath("getStationOrdersById", { id: "../another-station" }),
    ).toThrow("valid");
    expect(
      operationPath("getPublicStationsByIdPhotosByFileId", {
        id: "STN10008",
        fileId: "FIL10130",
      }),
    ).toBe("/public/stations/STN10008/photos/FIL10130");
  });
  it("preserves backend pagination and attaches the station access token", async () => {
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/station/orders");
      expect(config.params).toEqual({ page: 2, limit: 20 });
      expect(config.headers.get("Authorization")).toBe("Bearer station-access");
      return ok([{ unitId: "ORD10011" }], config);
    };
    const response = await stationRequest("getStationOrders", {
      query: { page: 2, limit: 20 },
    });
    expect(response.meta?.pages).toBe(2);
  });
  it("requires positive, whole station prices in currency units", () => {
    const schema = contracts.patchStationFuelPricesByFuelId.body as Schema;
    expect(validate(schema, { priceMinor: "150" })).toEqual({
      priceMinor: 150,
    });
    for (const priceMinor of [0, -1, 1.5, "", 100000001])
      expect(() => validate(schema, { priceMinor })).toThrow();
  });
  it("whitelists profile fields and leaves station assignment and type to administration", () => {
    expect(
      validate(contracts.patchStationProfile.body as Schema, {
        name: "New station name",
        latitude: 0,
        longitude: 0,
        kind: "DEPOT",
        code: "OTHER",
        fuelPrices: [{ fuelId: "FUL10001", priceMinor: 1 }],
      }),
    ).toEqual({ name: "New station name" });
  });
  it("requires all seven opening-hour entries and rejects invalid times", () => {
    const hours = Object.fromEntries(
      ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => [
        day,
        { open: "08:00", close: "18:00", closed: false },
      ]),
    );
    expect(
      validate(contracts.patchStationProfile.body as Schema, {
        workingHours: hours,
      }),
    ).toEqual({ workingHours: hours });
    expect(() =>
      validate(contracts.patchStationProfile.body as Schema, {
        workingHours: { ...hours, sun: { open: "25:00", close: "18:00" } },
      }),
    ).toThrow();
    expect(() =>
      validate(contracts.patchStationProfile.body as Schema, {
        photos: Array(21).fill("FIL10130"),
      }),
    ).toThrow("20");
  });
  it("enforces the device token for heartbeat, credential verification and dispensing", async () => {
    for (const operation of [
      "postStationDevicesHeartbeat",
      "postStationAuthorizationsVerify",
      "postStationDispenses",
    ] as const)
      await expect(stationRequest(operation)).rejects.toThrow("device");
    apiClient.defaults.adapter = async (config) => {
      expect(config.headers.get("X-Device-Token")).toBe("device-secret");
      expect(JSON.parse(config.data)).toEqual({ cardUid: "QA-RFID" });
      return ok({ authorization: { unitId: "AUT10006" } }, config);
    };
    await stationRequest("postStationAuthorizationsVerify", {
      deviceToken: " device-secret ",
      body: { cardUid: "QA-RFID" },
    });
  });
  it("posts an exact dispensing payload and a duplicate-request key", async () => {
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/station/dispenses");
      expect(config.headers.get("X-Device-Token")).toBe("test-device");
      expect(config.headers.get("Idempotency-Key")).toBeTruthy();
      expect(JSON.parse(config.data)).toEqual({
        credential: { token: "QR-token" },
        quantityLitres: 1.5,
        mileage: 42,
        pin: "123456",
      });
      return ok({ receipt: { unitId: "DSP10002" } }, config);
    };
    await stationRequest("postStationDispenses", {
      deviceToken: "test-device",
      body: {
        credential: { token: "QR-token" },
        quantityLitres: "1.5",
        mileage: "42",
        pin: "123456",
      },
    });
  });
  it("reuses the same dispensing key after a lost response and clears it after success", async () => {
    const keys: unknown[] = [];
    let count = 0;
    apiClient.defaults.adapter = async (config) => {
      keys.push(config.headers.get("Idempotency-Key"));
      if (++count === 1)
        throw new AxiosError("Network lost", "ERR_NETWORK", config);
      return ok({ receipt: { unitId: "DSP10002" } }, config);
    };
    const options = {
      deviceToken: "test-device",
      body: {
        credential: { cardUid: "RFID" },
        quantityLitres: 1,
        mileage: 0,
        pin: "123456",
      },
    };
    await expect(
      stationRequest("postStationDispenses", options),
    ).rejects.toThrow("server");
    expect(
      [...storage.entries()]
        .filter(([key]) => key.startsWith("neyfuel-station-request:"))
        .some(([, value]) => value.includes("123456")),
    ).toBe(false);
    await stationRequest("postStationDispenses", options);
    await stationRequest("postStationDispenses", options);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).not.toBe(keys[2]);
  });
  it("uploads multipart files and maps the returned file ID", async () => {
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/shared/files");
      expect(config.data).toBeInstanceOf(FormData);
      expect(config.headers.get("Content-Type")).not.toBe("application/json");
      return ok({ id: "FIL10130", originalName: "test.png" }, config);
    };
    const result = await uploadFile(
      new File(["test-image"], "test.png", { type: "image/png" }),
    );
    expect(result.data.id).toBe("FIL10130");
    await expect(
      uploadFile(new File(["test"], "script.js", { type: "text/javascript" })),
    ).rejects.toThrow("JPEG");
  });
  it("submits station acceptance and rejection to their own order endpoints", async () => {
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(String(config.url));
      return ok({}, config);
    };
    await stationRequest("postStationOrdersByIdAccept", {
      params: { id: "ORD10011" },
      body: {},
    });
    await stationRequest("postStationOrdersByIdReject", {
      params: { id: "ORD10012" },
      body: { reason: "Out of stock" },
    });
    expect(requests).toEqual([
      "/station/orders/ORD10011/accept",
      "/station/orders/ORD10012/reject",
    ]);
  });
  it("retains server validation details and request IDs", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Rejected", "ERR_BAD_REQUEST", config, undefined, {
        ...ok(null, config),
        status: 422,
        data: {
          success: false,
          message: "Invalid price",
          error: {
            code: "VALIDATION_ERROR",
            details: [{ field: "priceMinor", message: "Must be positive" }],
          },
          requestId: "qa-request",
        },
      });
    };
    await expect(
      stationRequest("patchStationFuelPricesByFuelId", {
        params: { fuelId: "FUL10005" },
        body: { priceMinor: 10 },
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      requestId: "qa-request",
      details: [{ field: "priceMinor", message: "Must be positive" }],
    });
  });
  it("uses zero-fraction XAF values and millilitre-to-litre quantities", () => {
    expect(formatMoney(150)).toBe("150 FCFA");
    expect(formatLitres(1500)).toBe("1.5 L");
    expect(idOf({ unitId: "STN10008", _id: "internal" })).toBe("STN10008");
  });
  it("downloads private files as authenticated binary responses", async () => {
    const file = new Blob(["test-pdf"], { type: "application/pdf" });
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/shared/files/FIL10130");
      expect(config.responseType).toBe("blob");
      expect(config.headers.get("Authorization")).toBe("Bearer station-access");
      return { ...ok(null, config), data: file };
    };
    expect(await fetchFile("FIL10130")).toBe(file);
  });
  it("preserves permission errors when private file downloads return JSON blobs", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, undefined, {
        ...ok(null, config),
        status: 403,
        data: new Blob(
          [
            JSON.stringify({
              success: false,
              message: "File access denied",
              error: { code: "FORBIDDEN" },
            }),
          ],
          { type: "application/json" },
        ),
      });
    };
    await expect(fetchFile("FIL10130")).rejects.toMatchObject({
      message: "File access denied",
      status: 403,
      code: "FORBIDDEN",
    });
  });
  it("creates safe retry keys without SubtleCrypto or randomUUID on HTTP LAN URLs", async () => {
    const browserCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto),
    });
    const keys: unknown[] = [];
    let calls = 0;
    apiClient.defaults.adapter = async (config) => {
      keys.push(config.headers.get("Idempotency-Key"));
      if (++calls === 1)
        throw new AxiosError("Network lost", "ERR_NETWORK", config);
      return ok({}, config);
    };
    const options = {
      params: { id: "ORD10011" },
      body: { reason: "HTTP browser retry check" },
    };
    await expect(
      stationRequest("postStationOrdersByIdReject", options),
    ).rejects.toThrow("server");
    await stationRequest("postStationOrdersByIdReject", options);
    await stationRequest("postStationOrdersByIdReject", options);
    expect(keys[0]).toMatch(
      /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/,
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[1]).not.toBe(keys[2]);
    expect(
      [...storage.keys()].some((key) =>
        key.startsWith("neyfuel-station-request:"),
      ),
    ).toBe(false);
  });
  it("preserves SHA-256 retry slots from existing browser sessions", async () => {
    const browserCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto),
    });
    const body = { reason: "Resume an existing request" };
    const digest = createHash("sha256")
      .update(
        JSON.stringify([
          apiBaseUrl,
          "OPR10006",
          "/station/orders/ORD10012/reject",
          body,
        ]),
      )
      .digest("hex");
    const slot = "neyfuel-station-request:" + digest;
    storage.set(slot, "previous-session-request-key");
    apiClient.defaults.adapter = async (config) => {
      expect(config.headers.get("Idempotency-Key")).toBe(
        "previous-session-request-key",
      );
      return ok({}, config);
    };
    await stationRequest("postStationOrdersByIdReject", {
      params: { id: "ORD10012" },
      body,
    });
    expect(storage.has(slot)).toBe(false);
  });
});
