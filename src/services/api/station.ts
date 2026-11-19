import axios from "axios";
import { sha256 } from "@noble/hashes/sha2.js";
import contracts from "./contracts.json";
import { apiClient } from "./client";
import { apiBaseUrl } from "./environment";
import { readTokens } from "./tokens";
export type Row = Record<string, unknown>;
export type Operation = keyof typeof contracts;
export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page?: number;
    pages?: number;
    total?: number;
    limit?: number;
    currency?: string;
    groupBy?: string;
  };
  requestId?: string;
}
export interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: string[];
  nullable?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean | number;
  minItems?: number;
  maxItems?: number;
  format?: string;
}
export class StationApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = "NETWORK_ERROR",
    public details: { field: string; message: string }[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}
export function idOf(value: unknown): string {
  return typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? String(
          (value as Row).unitId ||
            (value as Row)._id ||
            (value as Row).id ||
            "",
        )
      : "";
}
export function labelOf(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(labelOf).join(", ");
    const row = value as Row;
    return labelOf(
      row.name ||
        row.registrationNumber ||
        row.number ||
        row.code ||
        row.unitId ||
        row._id,
    );
  }
  return String(value);
}
export function fieldLabel(name: string) {
  return name
    .replace(/Minor$/, "")
    .replace(/Ml$/, "")
    .replace(/Id$/, " ID")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
export function operationPath(
  key: Operation,
  params: Record<string, string> = {},
) {
  return contracts[key].path.replace(/:(\w+)/g, (_, name: string) => {
    const value = params[name];
    if (!/^(?:[A-Z]{3}\d{5,15}|[a-f\d]{24})$/i.test(value || ""))
      throw new Error(`Select a valid ${fieldLabel(name)}.`);
    return encodeURIComponent(value);
  });
}
export function validate(
  schema: Schema,
  value: unknown,
  path = "Request",
): unknown {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error(`${path} must be an object.`);
    const source = value as Row,
      result: Row = {};
    for (const [key, child] of Object.entries(schema.properties || {})) {
      const item = source[key];
      if (item === undefined || item === "" || item === null) {
        if (schema.required?.includes(key))
          throw new Error(`Please complete ${fieldLabel(key)}.`);
        continue;
      }
      result[key] = validate(child, item, `${path}.${key}`);
    }
    return result;
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) throw new Error(`${path} must be a list.`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      throw new Error(`${path} supports up to ${schema.maxItems} entries.`);
    return value.map((item) => validate(schema.items || {}, item, path));
  }
  if (schema.type === "integer" || schema.type === "number") {
    if (value === "" || value === null || typeof value === "boolean")
      throw new Error(`Enter a number for ${path}.`);
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      (schema.type === "integer" && !Number.isInteger(number))
    )
      throw new Error(`${path} must be a valid ${schema.type}.`);
    const exclusive =
      schema.exclusiveMinimum === true
        ? schema.minimum
        : typeof schema.exclusiveMinimum === "number"
          ? schema.exclusiveMinimum
          : undefined;
    if (
      (schema.minimum !== undefined && number < schema.minimum) ||
      (exclusive !== undefined && number <= exclusive) ||
      (schema.maximum !== undefined && number > schema.maximum)
    )
      throw new Error(`${path} is outside the allowed range.`);
    return number;
  }
  if (schema.type === "boolean") {
    if (typeof value !== "boolean")
      throw new Error(`${path} must be true or false.`);
    return value;
  }
  const text = path.toLowerCase().includes("password")
    ? String(value)
    : String(value).trim();
  if (
    (schema.minLength !== undefined && text.length < schema.minLength) ||
    (schema.maxLength !== undefined && text.length > schema.maxLength) ||
    (schema.pattern && !new RegExp(schema.pattern).test(text)) ||
    (schema.enum && !schema.enum.includes(text))
  )
    throw new Error(`Check the format of ${path.replace(/^Request\./, "")}.`);
  if (schema.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
    throw new Error("Enter a valid email address.");
  return text;
}
const pending = new Map<string, string>();
function newRequestId() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  if (!browserCrypto?.getRandomValues)
    throw new Error(
      "Your browser cannot create a transaction request ID. Please use a current browser.",
    );
  const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function transactionKey(path: string, body: unknown) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([apiBaseUrl, readTokens()?.user._id, path, body]),
  );
  // Keep the same SHA-256 storage keys on HTTPS, localhost and HTTP LAN URLs.
  const digest = sha256(bytes);
  const slot =
    "neyfuel-station-request:" +
    Array.from(digest, (x) => x.toString(16).padStart(2, "0")).join("");
  let key = pending.get(slot);
  try {
    key ||= sessionStorage.getItem(slot) || undefined;
  } catch {
    /* Memory fallback. */
  }
  key ||= newRequestId();
  pending.set(slot, key);
  try {
    sessionStorage.setItem(slot, key);
  } catch {
    /* Memory fallback. */
  }
  return { key, slot };
}
export async function stationRequest<T = Row>(
  key: Operation,
  options: {
    params?: Record<string, string>;
    query?: Row;
    body?: unknown;
    deviceToken?: string;
    idempotencyKey?: string;
  } = {},
): Promise<Envelope<T>> {
  const definition = contracts[key],
    path = operationPath(key, options.params);
  if (definition.deviceRequired && !options.deviceToken?.trim())
    throw new Error(
      "Enter the token issued for this POS device by your administrator.",
    );
  const body =
    definition.body && options.body !== undefined
      ? validate(definition.body as Schema, options.body)
      : options.body;
  const retry =
    definition.idempotent && !options.idempotencyKey
      ? await transactionKey(path, body)
      : null;
  try {
    const response = await apiClient.request<Envelope<T>>({
      method: definition.method,
      url: path,
      params: options.query,
      data: body,
      headers: {
        ...(options.deviceToken
          ? { "X-Device-Token": options.deviceToken.trim() }
          : {}),
        ...(options.idempotencyKey || retry?.key
          ? { "Idempotency-Key": options.idempotencyKey || retry?.key }
          : {}),
      },
    });
    if (response.data.success !== true)
      throw new StationApiError(
        response.data.message || "The request could not be completed.",
      );
    if (retry) {
      pending.delete(retry.slot);
      try {
        sessionStorage.removeItem(retry.slot);
      } catch {
        /* Storage unavailable. */
      }
    }
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const envelope = error.response?.data;
      throw new StationApiError(
        envelope?.message ||
          (error.response
            ? "Unable to complete this request."
            : "Unable to reach the server. Please try again."),
        error.response?.status,
        envelope?.error?.code,
        envelope?.error?.details,
        envelope?.requestId,
      );
    }
    throw error;
  }
}
export async function uploadFile(file: File) {
  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
  )
    throw new Error("Choose a JPEG, PNG or PDF no larger than 5 MB.");
  const body = new FormData();
  body.append("file", file);
  return stationRequest<{
    id: string;
    originalName: string;
    mimeType: string;
    downloadUrl: string;
  }>("postSharedFiles", { body });
}
export async function fetchFile(id: string) {
  try {
    return (
      await apiClient.get<Blob>(operationPath("getSharedFilesById", { id }), {
        responseType: "blob",
      })
    ).data;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;
    let envelope = error.response?.data;
    if (envelope instanceof Blob) {
      try {
        envelope = JSON.parse(await envelope.text());
      } catch {
        envelope = null;
      }
    }
    throw new StationApiError(
      envelope?.message || "Unable to download this private file.",
      error.response?.status,
      envelope?.error?.code,
      envelope?.error?.details,
      envelope?.requestId,
    );
  }
}
export async function publicRequest<T = Row>(
  path: string,
  query?: Row,
): Promise<Envelope<T>> {
  const response = await axios.get<Envelope<T>>(`${apiBaseUrl}${path}`, {
    params: query,
    timeout: 20000,
  });
  if (!response.data.success) throw new Error(response.data.message);
  return response.data;
}
export function formatMoney(value: unknown, currency = "XAF") {
  if (typeof value !== "number") return "—";
  try {
    const digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 0;
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value / 10 ** digits)} ${currency === "XAF" ? "FCFA" : currency}`;
  } catch {
    return `${value} ${currency}`;
  }
}
export function formatLitres(value: unknown) {
  return typeof value === "number"
    ? `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} L`
    : "—";
}
export { contracts };
