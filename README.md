# Ney Fuel Partner Station Portal

A live React station workspace connected to the Ney Fuel API. Station users manage their retail fuel prices, profile, delivery requests and dispensing operations without simulated business records.

## Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

The application is mounted at **`/partner/station/`**. Vite prints the available local port. Keep this base path when opening a deep link.

The supplied example uses the development tunnel:

```dotenv
VITE_AUTH_MODE=api
VITE_API_BASE_URL=https://qkwbdl37-5121.inc1.devtunnels.ms/api/v1
VITE_AUTH_API_BASE_URL=https://qkwbdl37-5121.inc1.devtunnels.ms/api/v1/public/auth
VITE_DATA_MODE=api
```

These are public service URLs. Do not put passwords, access tokens, refresh tokens or POS device credentials into Vite environment variables. Set the intended backend URLs before building for deployment.

## Workspace

- **Overview:** station sales, dispensed quantities, unsettled totals, fuel stock and daily sales chart.
- **Fuel prices:** station-specific prices per litre and fuel availability. Unconfigured retail prices are shown explicitly. XAF prices use whole FCFA units.
- **Delivery requests:** inspect, approve and reject eligible customer orders. Order messages follow assignment/status and backend permissions.
- **Fuel dispensing:** verify QR/RFID credentials, enter quantity/mileage/PIN, review and commit using an authorized POS device token. Completed transactions have printable receipts.
- **Operations:** inventory/movements, authorizations, devices/heartbeat, transactions, settlements and reports.
- **Station profile:** contact/location details, weekly hours, facilities and photo upload/gallery.
- **Account:** name/language/photo, password, phone verification, POS PIN, notifications, wallet/ledger, support and private documents.

There are no station-side endpoints for creating staff, registering devices, recording stock refills or creating settlements in the supplied collection. Those administrator functions are not simulated in this workspace. Existing legacy demo modules remain outside the live router.

## Authentication and scope

Station accounts are provisioned by the administrator. Login uses `/public/auth/login`; the backend `STATION` role and actual `user.station` assignment are preserved. Station endpoints enforce account ownership on the server. No station assignment is inferred from an email or demo record.

Access/refresh tokens are stored in the current tab. Sessions refresh automatically; concurrent refreshes share one request. Temporary refresh network failures retain credentials for retry. Incorrect current-password responses do not trigger session rotation or sign-out. Logout calls `/shared/auth/logout` before clearing local state. Local storage persists interface preferences, rather than authenticated sessions or business records.

Customer OTP login, driver registration and external payment creation do not grant station access. See [authentication details](AUTH_API.md).

## Validation and testing

```sh
npm test
npm run typecheck
npm run build
```

There are **56 passing tests**, including 42 API/authentication checks and 14 existing inventory-engine tests. The production build is generated in `dist/`.

[Live verification evidence](docs/STATION_API_VERIFICATION.md) records all 22 Station & POS endpoints, relevant folder 01/09 behavior, browser checks and the limitations of individual write-path tests. The [sanitized JSON report](docs/station-api-verification.json) contains statuses and response shapes without credentials or personal response values.

For repeatable read-only API diagnostics, supply `STATION_EMAIL` and `STATION_PASSWORD` through your shell environment, or use `STATION_ACCESS_TOKEN`:

```sh
npm run verify:station -- --output /tmp/neyfuel-station-check.json
```

The verifier reads `.env.local`; `STATION_API_URL` overrides its backend URL. It checks lists and available detail records and logs out its own login session. It never changes profiles, prices, stock, orders, payments or messages. If using a supplied access token, it leaves that session active. Detail checks without existing records are reported as skipped.

## Code layout

- `src/services/api/contracts.json`: 53 method/path contracts from collection folders 01, 08 and 09, checked against live OpenAPI schemas.
- `src/services/api/station.ts`: envelope handling, validation, paths, private uploads/downloads, currency/quantity formatting and transaction retry keys.
- `src/services/api/liveAuth.ts`, `client.ts`, `tokens.ts`: login, token refresh and authenticated transport.
- `src/features/live/`: live layouts and station screens.
- `src/app/router/index.tsx`: station-scoped navigation.
- `scripts/verify-station.mjs`: read-only backend diagnostics.
