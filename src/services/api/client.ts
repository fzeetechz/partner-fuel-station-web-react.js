import axios from "axios";
import { authMode, liveAuth } from "./liveAuth";
import { readTokens } from "./tokens";
export const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    "https://neyfuel.wise-hustlers.com/backend/api/v1",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});
// Business endpoints keep their existing mode; auth independently defaults to the real API.
export const dataMode = import.meta.env.VITE_DATA_MODE || "mock";
apiClient.interceptors.request.use(async (config) => {
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
    return Promise.reject(error);
  },
);
