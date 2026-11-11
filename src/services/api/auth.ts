// Public auth facade; unsupported endpoints intentionally do not fabricate a session.
import { liveAuth } from "./liveAuth";
export const authenticationService = {
  ...liveAuth,
  async verify(_code: string) {
    throw new Error("OTP verification API has not been supplied yet.");
  },
  async requestReset(_email: string) {
    throw new Error(
      "Password recovery API has not been supplied yet. Contact your administrator.",
    );
  },
  async resetPassword(_password: string) {
    throw new Error(
      "Password reset API has not been supplied yet. Contact your administrator.",
    );
  },
};
