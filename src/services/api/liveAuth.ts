import axios from "axios";
import type { Session } from "../../types";
import { useAppStore } from "../../store";
import { readTokens, saveTokens, type AuthTokens } from "./tokens";

export const authMode = import.meta.env.VITE_AUTH_MODE || "api";
export const authHttp = axios.create({
  baseURL: (
    import.meta.env.VITE_AUTH_API_BASE_URL ||
    "https://neyfuel.wise-hustlers.com/backend/api/v1/public/auth"
  ).replace(/\/$/, ""),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}
export async function authPost<T>(
  path: string,
  body: unknown,
  allowNull = false,
): Promise<T> {
  try {
    const response = await authHttp.post<Envelope<T>>(path, body);
    if (!response.data.success || (!allowNull && !response.data.data))
      throw new Error(response.data.message || "Authentication failed.");
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response?.data?.message ||
          (error.response
            ? "Authentication failed. Please try again."
            : "Unable to reach the authentication server. Check your connection and try again."),
      );
    }
    throw error;
  }
}
function toSession(tokens: AuthTokens): Session {
  const user = tokens.user;
  if (!user?.active)
    throw new Error("This account is inactive. Contact support.");
  // The API also returns STATION. Use operator permissions unless it explicitly
  // identifies an owner; keep the original backend role in the stored tokens.
  const role = user.role === "STATION" ? "STATION_OPERATOR" : user.role;
  if (role !== "FUEL_STATION_OWNER" && role !== "STATION_OPERATOR")
    throw new Error(
      `This account has the ${user.role} role and cannot access this portal. Contact your administrator.`,
    );
  return {
    name: user.name,
    email: user.email,
    role,
    stationIds: user.stationIds || [],
    expires: tokens.expiresAt,
  };
}
function accept(data: AuthTokens, expectedRefresh?: string): Session {
  if (
    !data.accessToken ||
    !data.refreshToken ||
    !data.user ||
    !(data.expiresIn > 0)
  )
    throw new Error(
      "The server returned an invalid session. Please sign in again.",
    );
  const tokens = { ...data, expiresAt: Date.now() + data.expiresIn * 1000 };
  const session = toSession(tokens);
  if (expectedRefresh && readTokens()?.refreshToken !== expectedRefresh)
    throw new Error("Session changed. Please sign in again.");
  saveTokens(tokens);
  useAppStore.getState().setSession(session);
  return session;
}
let refreshing: Promise<Session> | null = null;
export const liveAuth = {
  async login(email: string, password: string) {
    return accept(
      await authPost<AuthTokens>("/login", {
        email: email.trim().toLowerCase(),
        password,
      }),
    );
  },
  async register(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) {
    // This endpoint creates DRIVER accounts, which do not grant portal permissions.
    return authPost<AuthTokens>("/drivers/register", {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      password: input.password,
    });
  },
  requestOtp(phone: string, purpose: "LOGIN" | "RESET" = "LOGIN") {
    if (!/^\+[1-9]\d{6,14}$/.test(phone.trim()))
      return Promise.reject(
        new Error(
          "Enter your phone with country code, for example +6737123456.",
        ),
      );
    return authPost<{
      expiresIn: number;
      resendAfter: number;
      developmentOtp?: string;
    }>("/otp/request", { phone: phone.trim(), purpose });
  },
  resetPassword(phone: string, code: string, password: string) {
    return authPost<null>(
      "/password/reset",
      {
        phone: phone.trim(),
        code: code.trim(),
        password,
      },
      true,
    );
  },
  refresh(): Promise<Session> {
    if (refreshing) return refreshing;
    const token = readTokens()?.refreshToken;
    if (!token) return Promise.reject(new Error("Please sign in again."));
    refreshing = authPost<AuthTokens>("/refresh", { refreshToken: token })
      .then((data) => accept(data, token))
      .catch((error) => {
        if (readTokens()?.refreshToken === token)
          useAppStore.getState().setSession(null);
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  },
  async restore() {
    const tokens = readTokens();
    if (!tokens) {
      useAppStore.getState().setSession(null);
      return;
    }
    if (tokens.expiresAt <= Date.now() + 60000) {
      await this.refresh();
      return;
    }
    try {
      useAppStore.getState().setSession(toSession(tokens));
    } catch {
      useAppStore.getState().setSession(null);
    }
  },
};
