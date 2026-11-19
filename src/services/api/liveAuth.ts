import axios from "axios";
import { authBaseUrl } from "./environment";
import type { Session } from "../../types";
import { useAppStore } from "../../store";
import {
  readTokens,
  saveTokens,
  type AuthTokens,
  type AuthUser,
} from "./tokens";

export const authMode = import.meta.env.VITE_AUTH_MODE || "api";
export const authHttp = axios.create({
  baseURL: authBaseUrl,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
export class AuthApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "AUTH_ERROR",
  ) {
    super(message);
  }
}
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
      throw new AuthApiError(
        response.data.message || "Authentication failed.",
        400,
      );
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new AuthApiError(
        error.response?.data?.message ||
          (error.response
            ? "Authentication failed. Please try again."
            : "Unable to reach the authentication server. Check your connection and try again."),
        error.response?.status || 0,
        error.response?.data?.error?.code,
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
    stationIds:
      user.stationIds ||
      (user.station
        ? [
            typeof user.station === "string"
              ? user.station
              : user.station.unitId || user.station._id,
          ]
        : []),
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
  verifyOtp(phone: string, code: string, name?: string) {
    return authPost<AuthTokens>("/otp/verify", {
      phone: phone.trim(),
      code: code.trim(),
      ...(name ? { name: name.trim() } : {}),
    });
  },
  updateUser(user: AuthUser) {
    const tokens = readTokens();
    if (!tokens) return;
    const next = { ...tokens, user: { ...tokens.user, ...user } };
    const session = toSession(next);
    saveTokens(next);
    useAppStore.getState().setSession(session);
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
    ).then((data) => {
      useAppStore.getState().setSession(null);
      return data;
    });
  },
  refresh(): Promise<Session> {
    if (refreshing) return refreshing;
    const token = readTokens()?.refreshToken;
    if (!token) return Promise.reject(new Error("Please sign in again."));
    refreshing = authPost<AuthTokens>("/refresh", { refreshToken: token })
      .then((data) => accept(data, token))
      .catch((error) => {
        if (
          readTokens()?.refreshToken === token &&
          error instanceof AuthApiError &&
          [400, 401, 403].includes(error.status)
        )
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
