import { afterEach, describe, expect, it, vi } from "vitest";
import { authHttp, liveAuth } from "./liveAuth";

vi.mock("../../store", () => ({ useAppStore: { getState: () => ({ setSession: vi.fn() }) } }));
const originalAdapter = authHttp.defaults.adapter;
afterEach(() => { authHttp.defaults.adapter = originalAdapter; });

describe("partner password recovery", () => {
  it("requests RESET codes and retains the response OTP and timing", async () => {
    authHttp.defaults.adapter = async (config) => {
      expect(config.url).toBe("/otp/request");
      expect(JSON.parse(config.data)).toEqual({ phone: "+6737123456", purpose: "RESET" });
      return { config, status: 200, statusText: "OK", headers: {}, data: {
        success: true, message: "Verification code requested", data: { expiresIn: 300, resendAfter: 60, developmentOtp: "293131" },
      } };
    };
    expect(await liveAuth.requestOtp(" +6737123456 ", "RESET")).toEqual({ expiresIn: 300, resendAfter: 60, developmentOtp: "293131" });
  });

  it("posts the password reset payload and accepts successful null data", async () => {
    authHttp.defaults.adapter = async (config) => {
      expect(config.url).toBe("/password/reset");
      expect(JSON.parse(config.data)).toEqual({ phone: "+6737123456", code: "293131", password: " StrongPassword123! " });
      return { config, status: 200, statusText: "OK", headers: {}, data: { success: true, message: "Password changed. Please log in again.", data: null } };
    };
    await expect(liveAuth.resetPassword(" +6737123456 ", " 293131 ", " StrongPassword123! ")).resolves.toBeNull();
  });

  it("surfaces a rejected or expired reset code", async () => {
    authHttp.defaults.adapter = async (config) => ({ config, status: 200, statusText: "OK", headers: {}, data: { success: false, message: "Verification code expired", data: null } });
    await expect(liveAuth.resetPassword("+6737123456", "293131", "StrongPassword123!")).rejects.toThrow("Verification code expired");
  });
});
