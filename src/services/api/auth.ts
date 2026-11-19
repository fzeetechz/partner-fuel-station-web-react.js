import { liveAuth } from "./liveAuth";
export const authenticationService = {
  ...liveAuth,
  verify: (phone: string, code: string, name?: string) =>
    liveAuth.verifyOtp(phone, code, name),
  requestReset: (phone: string) => liveAuth.requestOtp(phone, "RESET"),
};
