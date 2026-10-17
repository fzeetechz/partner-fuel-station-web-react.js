# NeyFuel Partner Fuel Station Portal

A responsive React + Vite + TypeScript frontend for station owners and operators. The portal uses persistent, related mock records and simulated financial workflows. It does not process payments or connect to native POS hardware.

## Run locally

Node.js 22.12+ or 24 LTS recommended.

```sh
npm install
npm run dev
```

On Windows PowerShell with script restrictions, use `npm.cmd` in place of `npm`.

```sh
npm run build
npm test
npm run preview
```

Copy `.env.example` to `.env.local` to override configuration. Mock mode is the default. Vite serves the portal at the URL printed in the terminal. Hosting must fall back to `index.html` for client-side routes.

## Demo credentials

| Access | Email | Password |
|---|---|---|
| Owner | owner@neyfuel.com | NeyFuel@2026 |
| Operator | operator@neyfuel.com | NeyFuel@2026 |

Sign in at `/auth/login`. Sessions last eight hours. Owner registration, forgot/reset password, and verification (`123456`) are browser-local simulations. Registered users join the existing demo owner workspace. No email is sent and demo credentials are stored unencrypted; use fictional information only.

## Pages and workflows

- Overview with date filters, interactive revenue and transaction charts, fuel distribution, payment breakdown, inventory, POS status, and recent activity.
- Station selector scopes all business pages to one of two demo stations.
- Station profiles with validated edits.
- Staff creation, editing, assignment, activation/deactivation, activity, deletion guards, filtering, sorting, and pagination.
- Fuel tank configuration, refills, signed adjustments, threshold alerts, movement history, and CSV exports.
- SUNMI V2 Pro mock registry, assignment, online/offline status, activity, and simulated sync.
- Transaction filters, sales, digital receipts, CSV, and print / Save as PDF through the browser print dialog.
- Corporate QR/RFID references with demo expiry, quantity, fuel, mileage, and single-use validation.
- Settlement history, date/status filters, reconciliation details, exports, and clearly marked mock completion.
- Fuel, inventory, transaction, settlement, operator, and period reports using shared records.
- Invoices derived from transaction records, receipt preview, print and PDF via browser print.
- Notification history, filters, unread count, individual/all read actions.
- Local profile, password, notification preferences, persistent light/dark themes, and English/French navigation and dashboard copy.
- Settings → Demo workspace resets business data. This does not reset account credentials or preferences.

Operators have access to operational pages and cannot invoke owner mutations. Owner-only routes and service guards are both present. This is a frontend convenience, not a security boundary; production must enforce authorization server-side.

## Data architecture

`src/types` defines shared contracts. `src/services/mock/seed.ts` creates related station datasets; `engine.ts` validates and applies sales and stock changes. The repository selects mock storage or Axios requests based on `VITE_DATA_MODE`. All pages obtain data through TanStack Query hooks; Zustand persists session and UI preferences. Forms use React Hook Form + Zod; charts use Recharts; Tailwind is available alongside the shared CSS design system.

Completed demo sales atomically reduce stock, create a stock movement, generate notification/receipt records, and consume a linked authorization. Reports calculate from completed transactions. Seed inventory is the opening available tank balance; historical transactions predate that opening balance and are not deducted again. Settlement amounts are derived from linked corporate transactions. Financial values use Ghana cedis (GHS); fuel volumes use liters.

Data persists under `neyfuel-database-v1` in localStorage. Local mock writes are synchronous and intended for a single browser tab; this is not a concurrent transaction service. CSV exports protect spreadsheet formula prefixes. Preferences persist under `neyfuel-preferences-v1`.

## Future API integration

Set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL` only after implementing the contracts in `src/services/repositories/portal.ts`: `GET /partner/snapshot`, resource updates/deletes, `POST /transactions`, `/inventory/adjustments`, `/notifications/read`, and `/settlements/:id/simulate`. These endpoints are proposed integration contracts, not an existing backend. Authentication currently remains demo-only; implement backend login/registration/reset, JWT refresh, server permissions, station scope, atomic authorization locking, stock transactions, wallet verification, audit records, and real settlement reconciliation before production use. No API token is fabricated or attached by the frontend.

Native SUNMI scanning, NFC, and thermal printing are intentionally outside the web scope. PDF output uses the browser’s Save as PDF destination. Localization currently covers navigation and overview introductory text; other page content is English. Notification preferences are saved locally; event history retains all events.

The supplied logo and PowerFuel requirements document were not present in the repository or attachment. The implementation uses a text wordmark, Lucide fuel symbol, and requested navy/orange palette. Add approved branding assets under `src/assets/branding` and replace `Brand` when available.

## Verification

`npm test` runs 14 tests covering transaction totals, stock reduction, immutable failure paths, invalid quantities, inactive operators, station mismatch, expired or over-limit authorizations, duplicate-use prevention, mileage, refill bounds, and corporate settlement linkage. `npm run build` performs strict TypeScript and unused-code checks and creates `dist/`.

With the development server running, `node scripts/browser-check.mjs` uses an isolated headless Chromium browser to verify login, every main route, staff creation/deactivation/deletion, stock refills, owner and operator sales, receipts, print layout and PDF generation, single-use corporate dispensing, mobile layout/navigation, persistent theme, and operator route/action restrictions. It records screenshots, a PDF receipt, and results in ignored `test-results/`. It uses a separate disposable profile, clears only that profile's demo storage, and checks for uncaught exceptions. Set `BROWSER_PATH` to your installed Chromium/Chrome/Edge executable if auto-detection does not find it; set `PORTAL_URL` to use a different local port. Browser tests require permission to launch local subprocesses.
