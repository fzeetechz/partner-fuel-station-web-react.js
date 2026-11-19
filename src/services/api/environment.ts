export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  "https://neyfuel.wise-hustlers.com/backend/api/v1"
).replace(/\/+$/, "");
export const authBaseUrl = (
  import.meta.env.VITE_AUTH_API_BASE_URL || `${apiBaseUrl}/public/auth`
).replace(/\/+$/, "");
