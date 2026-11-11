// Tokens stay in this tab; passwords are never persisted by API authentication.
export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
  companyId?: string;
  stationIds?: string[];
  status?: string;
}
export interface AuthTokens {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  expiresAt: number;
}
const key = "neyfuel-api-session-v1";
export function readTokens(): AuthTokens | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    return value?.accessToken &&
      value?.refreshToken &&
      value?.user &&
      Number.isFinite(value.expiresAt)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function clearTokens() {
  sessionStorage.removeItem(key);
}
export function saveTokens(tokens: AuthTokens) {
  sessionStorage.setItem(key, JSON.stringify(tokens));
}
