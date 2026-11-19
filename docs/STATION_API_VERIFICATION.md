# Ney Fuel Partner Station Portal — API Verification

Verified on 19 November 2026 against the supplied Postman collection and the live tunnel OpenAPI definition.

## Results

- Folder **08 — Station & POS: 22/22 APIs implemented and verified with successful live responses**.
- Folders **01 and 09** were checked for authentication, ownership and role restrictions. Their station workflows use the live API.
- **56 automated tests pass**: 42 API/authentication checks and 14 existing inventory-engine tests.
- TypeScript and production build pass.
- **24 read-only API diagnostics passed** with existing QA records.
- Browser checks covered the overview and 15 other screens, price review, incorrect-password handling, mobile navigation, profile/photo saves, upload submission locks, POS verification, dispensing, printable receipt and logout. Four fully loaded mobile screens had no horizontal overflow.

## Implemented workspace

- Overview: actual UTC-day sales, quantity, transaction and unsettled totals; seven-day sales report and stock.
- Fuel prices: station-specific per-litre prices, availability, unconfigured price state, validation and confirmation. XAF uses whole FCFA units.
- Delivery requests: details, station acceptance/stock reservation, rejection/refund, and order messages.
- Authorizations and dispensing: assigned authorization details, QR/RFID verification, required POS token, six-digit PIN, review, duplicate-request protection and printable receipt.
- Inventory/movements, devices/heartbeat, transactions/receipts, settlements and sales/low-stock reports.
- Station profile: description, contact/address fields, all seven working days, facilities and up to 20 uploaded photos.
- Account settings: profile name/language/photo, password change, phone verification and dispensing PIN.
- Wallet/ledger, notifications/read state, support tickets/replies, private file upload and authenticated downloads.
- Responsive navigation, backend pagination, current-page search/export, loading/empty/error states and readable review screens.
- Live mode is the default. Mock staff administration, simulated settlement/refill/import controls and invented snapshot URLs are not part of live navigation.

## Role and verification boundaries

Station staff must use password login: `/public/auth/otp/verify` returned `403 Staff accounts must use password login`. Recovery uses RESET OTP and the password-reset endpoint. Driver registration is not a station onboarding method; its existing service contract is retained but not offered in station navigation.

External payment creation is restricted to USER/EMPLOYEE/MANAGER and returned 403 for STATION. There is no payment-creation or fabricated checkout flow in the station UI. Payment lookup/checkout were checked against missing records, not a real provider transaction.

The station could retrieve its own order messages. Read receipts are restricted to chat participants; the station account received 403. Sending to a cancelled order returned 409. The UI permits a send attempt only after driver assignment, respects backend permission errors and keeps completed/cancelled orders read-only.

Support create/reply forms are wired and schema-validated. Their negative validation responses were checked without opening an unsolicited support conversation.

## Live fixture safety

The real station account was used for read-only checks. All business mutations used a separate `QA-PARTNER-1795082737` station with test users, fuel, company, vehicle, card and device. The original station prices, profile, stock, orders and password were not changed.

Positive checks included station price/profile, account profile/photo, phone verification, password change/reset, PIN, session refresh/logout, device heartbeat, RFID verification/dispensing, receipts, settlements, delivery acceptance/rejection and notification read state. Browser tests also saved a QA price and profile/photo and completed a separate dispensing transaction.

All nine mutable fixture resources are inactive. Test orders are closed and dispensing history is settled. Private uploads, ledger/audit/history entries and dummy wallet balances remain because the collection provides no deletion endpoints. Their IDs appear in [the sanitized report](station-api-verification.json); credentials, OTPs and token values do not.

## Endpoint evidence

| Folder | Method | Endpoint | Result | Workspace |
| --- | --- | --- | --- | --- |
| 01 | GET | `/public/config` | 200 · live success | Workspace currency and integration metadata |
| 01 | GET | `/public/fuels` | 200 · live success | Station fuel catalogue lookup |
| 01 | GET | `/public/stations` | 200 · live success | Public API diagnostics; consumer station discovery |
| 01 | GET | `/public/stations/:id/photos/:fileId` | 200 · live success | /stations photo gallery |
| 01 | POST | `/public/auth/login` | 200 · live success | /auth/login |
| 01 | POST | `/public/auth/otp/request` | 200 · live success | /auth/forgot; phone verification in /settings |
| 01 | POST | `/public/auth/otp/verify` | 403 · guard or validation response verified | Not exposed: backend rejects staff OTP login |
| 01 | POST | `/public/auth/refresh` | 200 · live success | Automatic session refresh |
| 01 | POST | `/public/auth/password/reset` | 200 · live success | /auth/forgot; phone verification in /settings |
| 01 | POST | `/public/auth/drivers/register` | Not executed · outside station workflow | Not exposed: driver onboarding is outside station access |
| 08 | GET | `/station/dashboard` | 200 · live success | /dashboard |
| 08 | GET | `/station/profile` | 200 · live success | /stations |
| 08 | PATCH | `/station/profile` | 200 · live success | /stations |
| 08 | GET | `/station/fuel-prices` | 200 · live success | /fuel-prices |
| 08 | PATCH | `/station/fuel-prices/:fuelId` | 200 · live success | /fuel-prices |
| 08 | GET | `/station/authorizations` | 200 · live success | /authorizations |
| 08 | GET | `/station/authorizations/:id` | 200 · live success | /authorizations |
| 08 | GET | `/station/inventory` | 200 · live success | /inventory |
| 08 | GET | `/station/inventory/movements` | 200 · live success | /inventory |
| 08 | GET | `/station/devices` | 200 · live success | /pos-devices |
| 08 | POST | `/station/devices/heartbeat` | 200 · live success | /pos-devices |
| 08 | POST | `/station/authorizations/verify` | 200 · live success | /dispense |
| 08 | POST | `/station/dispenses` | 201 · live success | /dispense |
| 08 | GET | `/station/transactions` | 200 · live success | /transactions |
| 08 | GET | `/station/transactions/:id/receipt` | 200 · live success | /transactions |
| 08 | GET | `/station/settlements` | 200 · live success | /settlements |
| 08 | GET | `/station/reports/fuel` | 200 · live success | /reports |
| 08 | GET | `/station/reports/inventory` | 200 · live success | /reports |
| 08 | GET | `/station/orders` | 200 · live success | /orders |
| 08 | GET | `/station/orders/:id` | 200 · live success | /orders |
| 08 | POST | `/station/orders/:id/accept` | 200 · live success | /orders |
| 08 | POST | `/station/orders/:id/reject` | 200 · live success | /orders |
| 09 | GET | `/shared/profile` | 200 · live success | /settings |
| 09 | PATCH | `/shared/profile` | 200 · live success | /settings |
| 09 | POST | `/shared/profile/password` | 200 · live success | /settings |
| 09 | POST | `/shared/profile/verify-phone` | 200 · live success | /settings |
| 09 | POST | `/shared/profile/pin` | 200 · live success | /settings |
| 09 | POST | `/shared/auth/logout` | 200 · live success | Sidebar → Sign out |
| 09 | GET | `/shared/wallet` | 200 · live success | /wallet |
| 09 | GET | `/shared/wallet/transactions` | 200 · live success | /wallet |
| 09 | POST | `/shared/payments` | 403 · guard or validation response verified | Not exposed: customer payment workflows |
| 09 | GET | `/shared/payments/:id` | 422 · guard or validation response verified | Not exposed: customer payment workflows |
| 09 | POST | `/shared/payments/:id/checkout` | 422 · guard or validation response verified | Not exposed: customer payment workflows |
| 09 | GET | `/shared/notifications` | 200 · live success | /notifications |
| 09 | PATCH | `/shared/notifications/:id/read` | 200 · live success | /notifications |
| 09 | GET | `/shared/support/tickets` | 200 · live success | /support |
| 09 | POST | `/shared/support/tickets` | 422 · guard or validation response verified | /support |
| 09 | POST | `/shared/support/tickets/:id/replies` | 422 · guard or validation response verified | /support |
| 09 | GET | `/shared/orders/:id/messages` | 200 · live success | Order messages; send availability follows assignment/status and permissions |
| 09 | POST | `/shared/orders/:id/messages/read` | 403 · guard or validation response verified | Order messages; send availability follows assignment/status and permissions |
| 09 | POST | `/shared/orders/:id/messages` | 409 · guard or validation response verified | Order messages; send availability follows assignment/status and permissions |
| 09 | POST | `/shared/files` | 201 · live success | /files; /stations photos; account avatar |
| 09 | GET | `/shared/files/:id` | 200 · live success | /files; /stations photos; account avatar |
