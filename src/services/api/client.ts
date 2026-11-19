import axios from "axios";
import { apiBaseUrl } from "./environment";
import { authMode, liveAuth } from "./liveAuth";
import { readTokens } from "./tokens";
import { useAppStore } from "../../store";
export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
// Business screens use live, station-scoped endpoints.
export const dataMode = import.meta.env.VITE_DATA_MODE || "api";
apiClient.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) config.headers.delete("Content-Type");
  if (authMode === "api") {
    const tokens = readTokens();
    if (tokens && tokens.expiresAt <= Date.now() + 30000)
      await liveAuth.refresh();
    const current = readTokens();
    if (current)
      config.headers.set("Authorization", `Bearer ${current.accessToken}`);
  }
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      authMode === "api" &&
      error.response?.status === 401 &&
      error.response?.data?.error?.code !== "INVALID_CREDENTIALS" &&
      config &&
      !config._authRetried &&
      readTokens()
    ) {
      config._authRetried = true;
      const current = readTokens();
      if (config.headers?.Authorization === `Bearer ${current?.accessToken}`)
        await liveAuth.refresh();
      config.headers.Authorization = `Bearer ${readTokens()?.accessToken}`;
      return apiClient.request(config);
    }
    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code !== "INVALID_CREDENTIALS" &&
      config?._authRetried &&
      config.headers?.Authorization === `Bearer ${readTokens()?.accessToken}`
    )
      useAppStore.getState().setSession(null);
    return Promise.reject(error);
  },
);
