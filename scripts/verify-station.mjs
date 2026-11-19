// Read-only API diagnostics. No prices, profiles, stock, orders or messages are changed.
import { readFile, writeFile } from "node:fs/promises";
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const definitions = JSON.parse(
  await readFile(
    new URL("../src/services/api/contracts.json", import.meta.url),
    "utf8",
  ),
);
const base = (
  process.env.STATION_API_URL ||
  process.env.VITE_API_BASE_URL ||
  "https://neyfuel.wise-hustlers.com/backend/api/v1"
).replace(/\/+$/, "");
let access = process.env.STATION_ACCESS_TOKEN || "",
  refresh = "",
  ownsSession = false;
const samples = new Map(),
  results = [];
function shape(data) {
  if (data === null) return "null";
  if (Array.isArray(data)) return data.length ? [shape(data[0])] : [];
  if (typeof data === "object")
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, shape(value)]),
    );
  return typeof data;
}
async function request(
  path,
  method = "GET",
  body,
  authenticated = true,
  retry = true,
) {
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(25000),
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authenticated ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const envelope = await response.json();
  if (response.status === 401 && authenticated && refresh && retry) {
    const rotated = await request(
      "/public/auth/refresh",
      "POST",
      { refreshToken: refresh },
      false,
      false,
    );
    if (rotated.envelope.success) {
      access = rotated.envelope.data.accessToken;
      refresh = rotated.envelope.data.refreshToken;
      return request(path, method, body, authenticated, false);
    }
  }
  return { status: response.status, envelope };
}
try {
  if (!access) {
    if (!process.env.STATION_EMAIL || !process.env.STATION_PASSWORD)
      throw new Error(
        "Set STATION_EMAIL and STATION_PASSWORD, or STATION_ACCESS_TOKEN.",
      );
    const { envelope } = await request(
      "/public/auth/login",
      "POST",
      {
        email: process.env.STATION_EMAIL,
        password: process.env.STATION_PASSWORD,
      },
      false,
    );
    if (
      !envelope.success ||
      !["STATION", "STATION_OPERATOR", "FUEL_STATION_OWNER"].includes(
        envelope.data?.user?.role,
      )
    )
      throw new Error(envelope.message || "A station account is required.");
    access = envelope.data.accessToken;
    refresh = envelope.data.refreshToken;
    ownsSession = true;
  }
  const reads = Object.values(definitions).filter(
    (operation) =>
      operation.method === "GET" &&
      !operation.path.startsWith("/shared/payments") &&
      operation.path !== "/shared/files/:id" &&
      !operation.path.includes("/photos/"),
  );
  for (const operation of [
    ...reads.filter((item) => !item.path.includes(":")),
    ...reads.filter((item) => item.path.includes(":")),
  ]) {
    let path = operation.path;
    if (path.includes(":id")) {
      const collection = path.includes("/authorizations/")
        ? "/station/authorizations"
        : path.includes("/transactions/")
          ? "/station/transactions"
          : "/station/orders";
      const sample = samples.get(collection);
      if (!sample) {
        results.push({
          path,
          status: null,
          outcome: "skipped",
          reason: "No existing record to inspect.",
        });
        continue;
      }
      path = path.replace(":id", encodeURIComponent(sample));
    }
    try {
      const { status, envelope } = await request(
        path,
        "GET",
        undefined,
        !operation.public,
      );
      const passed = status < 300 && envelope.success === true;
      results.push({
        path: operation.path,
        status,
        outcome: passed ? "passed" : "failed",
        message: envelope.message,
        responseDataShape: shape(envelope.data),
      });
      if (passed && Array.isArray(envelope.data) && envelope.data[0])
        samples.set(
          operation.path,
          envelope.data[0].unitId || envelope.data[0]._id,
        );
    } catch (error) {
      results.push({
        path: operation.path,
        outcome: "failed",
        message: error.message,
      });
    }
  }
} finally {
  if (ownsSession && access) {
    try {
      await request("/shared/auth/logout", "POST", undefined, true, false);
    } catch {
      console.error("Server sign-out could not be confirmed.");
    }
  }
}
for (const result of results)
  console.log(
    `${result.outcome.toUpperCase()} GET ${result.path}${result.status ? ` (${result.status})` : ""}`,
  );
const outputIndex = process.argv.indexOf("--output");
if (outputIndex !== -1 && process.argv[outputIndex + 1])
  await writeFile(
    process.argv[outputIndex + 1],
    JSON.stringify(
      { checkedAt: new Date().toISOString(), base, mode: "read-only", results },
      null,
      2,
    ) + "\n",
  );
if (results.some((result) => result.outcome === "failed")) process.exitCode = 1;
