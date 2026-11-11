import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, type AxiosAdapter } from "axios";
import { authHttp, liveAuth } from "./liveAuth";
import { apiClient } from "./client";
import { readTokens, clearTokens } from "./tokens";
import { useAppStore } from "../../store";

vi.mock("../../store", () => ({
  useAppStore: {
    getState: () => ({
      setSession: vi.fn((session: unknown) => {
        if (!session) clearTokens();
      }),
    }),
  },
}));

const response = (
  role = "FUEL_STATION_OWNER",
  accessToken = "access-1",
  refreshToken = "refresh-1",
) => ({
  user: {
    _id: "USER-1",
    name: "Test User",
    email: "test@example.com",
    role,
    active: true,
    companyId: "company-1",
    stationIds: ["station-1"],
  },
  accessToken,
  refreshToken,
  expiresIn: 900,
  tokenType: "Bearer",
});
const ok = (data: unknown, config: Parameters<AxiosAdapter>[0]) => ({
  data: { success: true, message: "Success", data },
  status: 200,
  statusText: "OK",
  headers: {},
  config,
});
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
describe("API authentication", () => {
  it("posts credentials, preserves password whitespace, and unwraps the user and tokens", async () => {
    authHttp.defaults.adapter = async (config) => {
      expect(config.url).toBe("/login");
      expect(JSON.parse(config.data)).toEqual({
        email: "test@example.com",
        password: " password ",
      });
      return ok(response(), config);
    };
    const session = await liveAuth.login(" Test@Example.com ", " password ");
    expect(session.role).toBe("FUEL_STATION_OWNER");
    expect(readTokens()?.accessToken).toBe("access-1");
    expect(JSON.stringify(readTokens())).not.toContain("password");
  });
  it.each(["STATION", "STATION_OPERATOR"])(
    "accepts %s with operator permissions and preserves the backend role and station scope",
    async (role) => {
      authHttp.defaults.adapter = async (config) => ok(response(role), config);
      const session = await liveAuth.login("station@example.com", "password");
      expect(session).toMatchObject({
        role: "STATION_OPERATOR",
        stationIds: ["station-1"],
      });
      expect(readTokens()?.user.role).toBe(role);
      await expect(liveAuth.refresh()).resolves.toMatchObject({
        role: "STATION_OPERATOR",
        stationIds: ["station-1"],
      });
      const state = useAppStore.getState();
      const getState = vi.spyOn(useAppStore, "getState").mockReturnValue(state);
      try {
        await liveAuth.restore();
        expect(state.setSession).toHaveBeenCalledWith(
          expect.objectContaining({
            role: "STATION_OPERATOR",
            stationIds: ["station-1"],
          }),
        );
      } finally {
        getState.mockRestore();
      }
    },
  );
  it("does not assign stations to a STATION account without backend assignments", async () => {
    authHttp.defaults.adapter = async (config) => {
      const data = response("STATION");
      return ok({ ...data, user: { ...data.user, stationIds: undefined } }, config);
    };
    const session = await liveAuth.login("station@example.com", "password");
    expect(session.stationIds).toEqual([]);
  });
  it.each(["DRIVER", "CORPORATE_ADMIN", "ADMIN", "UNKNOWN"])(
    "rejects %s accounts without saving tokens",
    async (role) => {
      authHttp.defaults.adapter = async (config) => ok(response(role), config);
      await expect(liveAuth.login("test@example.com", "password")).rejects.toThrow(role);
      expect(readTokens()).toBeNull();
    },
  );
  it("rejects DRIVER and inactive accounts without granting portal permissions", async () => {
    authHttp.defaults.adapter = async (config) =>
      ok(response("DRIVER"), config);
    await expect(
      liveAuth.login("driver@example.com", "password"),
    ).rejects.toThrow("DRIVER");
    expect(readTokens()).toBeNull();
    authHttp.defaults.adapter = async (config) =>
      ok(
        { ...response(), user: { ...response().user, active: false } },
        config,
      );
    await expect(
      liveAuth.login("inactive@example.com", "password"),
    ).rejects.toThrow("inactive");
  });
  it("surfaces the backend error message", async () => {
    authHttp.defaults.adapter = async (config) => ({
      ...ok(null, config),
      data: { success: false, message: "Email or password is incorrect" },
    });
    await expect(liveAuth.login("test@example.com", "wrong")).rejects.toThrow(
      "Email or password is incorrect",
    );
  });
  it("registers a driver with exactly the supported payload without granting portal access", async () => {
    authHttp.defaults.adapter = async (config) => {
      expect(config.url).toBe("/drivers/register");
      expect(JSON.parse(config.data)).toEqual({
        name: "New Driver",
        email: "new@example.com",
        phone: "+6737123456",
        password: " password ",
      });
      return ok(response("DRIVER"), config);
    };
    await liveAuth.register({
      name: " New Driver ",
      email: " NEW@example.com ",
      phone: " +6737123456 ",
      password: " password ",
    });
    expect(readTokens()).toBeNull();
  });
  it("requests LOGIN OTP and uses server expiry and resend timing", async () => {
    authHttp.defaults.adapter = async (config) => {
      expect(config.url).toBe("/otp/request");
      expect(JSON.parse(config.data)).toEqual({
        phone: "+6737123456",
        purpose: "LOGIN",
      });
      return ok(
        { expiresIn: 300, resendAfter: 60, developmentOtp: "123456" },
        config,
      );
    };
    expect(await liveAuth.requestOtp("+6737123456")).toMatchObject({
      expiresIn: 300,
      resendAfter: 60,
    });
    await expect(liveAuth.requestOtp("123")).rejects.toThrow("country code");
  });
  it("shares one concurrent refresh and rotates both tokens", async () => {
    authHttp.defaults.adapter = async (config) => ok(response(), config);
    await liveAuth.login("test@example.com", "password");
    const refresh = vi.fn<AxiosAdapter>(async (config) => {
      expect(config.url).toBe("/refresh");
      expect(JSON.parse(config.data)).toEqual({ refreshToken: "refresh-1" });
      return ok(
        response("FUEL_STATION_OWNER", "access-2", "refresh-2"),
        config,
      );
    });
    authHttp.defaults.adapter = refresh;
    await Promise.all([
      liveAuth.refresh(),
      liveAuth.refresh(),
      liveAuth.refresh(),
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(readTokens()).toMatchObject({
      accessToken: "access-2",
      refreshToken: "refresh-2",
    });
  });
  it("does not resurrect a session if logout occurs during refresh", async () => {
    authHttp.defaults.adapter = async (config) => ok(response(), config);
    await liveAuth.login("test@example.com", "password");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    authHttp.defaults.adapter = async (config) => {
      await pending;
      return ok(
        response("FUEL_STATION_OWNER", "access-2", "refresh-2"),
        config,
      );
    };
    const refresh = liveAuth.refresh();
    clearTokens();
    release();
    await expect(refresh).rejects.toThrow("Session changed");
    expect(readTokens()).toBeNull();
  });
  it("clears tokens on a rejected refresh", async () => {
    authHttp.defaults.adapter = async (config) => ok(response(), config);
    await liveAuth.login("test@example.com", "password");
    authHttp.defaults.adapter = async (config) => ({
      ...ok(null, config),
      data: { success: false, message: "Refresh token expired" },
    });
    await expect(liveAuth.refresh()).rejects.toThrow("Refresh token expired");
    expect(readTokens()).toBeNull();
  });
  it("attaches bearer tokens and retries an unauthorized request once after refresh", async () => {
    authHttp.defaults.adapter = async (config) => ok(response(), config);
    await liveAuth.login("test@example.com", "password");
    authHttp.defaults.adapter = async (config) =>
      ok(response("FUEL_STATION_OWNER", "access-2", "refresh-2"), config);
    let requests = 0;
    apiClient.defaults.adapter = async (config) => {
      requests++;
      if (requests === 1) {
        expect(config.headers.get("Authorization")).toBe("Bearer access-1");
        throw new AxiosError(
          "Unauthorized",
          "ERR_BAD_REQUEST",
          config,
          undefined,
          { ...ok(null, config), status: 401 },
        );
      }
      expect(config.headers.get("Authorization")).toBe("Bearer access-2");
      return ok({ value: true }, config);
    };
    await apiClient.get("/protected");
    expect(requests).toBe(2);
  });
  it("restores stored tokens and clears them on explicit logout", async () => {
    authHttp.defaults.adapter = async (config) => ok(response(), config);
    await liveAuth.login("test@example.com", "password");
    await liveAuth.restore();
    useAppStore.getState().setSession(null);
    expect(readTokens()).toBeNull();
  });
});
