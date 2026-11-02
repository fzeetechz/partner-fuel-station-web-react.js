# Authentication API integration

Authentication uses the supplied API by default; no `.env` file is required.
Copy `.env.example` to `.env.local` to override the authentication URL.

- `VITE_AUTH_API_BASE_URL`: public authentication base URL, ending in `/public/auth`.
- `VITE_API_BASE_URL`: separate business API base URL, ending in `/api/v1`.
- `VITE_DATA_MODE=mock`: existing business data remains simulated until those APIs are supplied.

Implemented POST endpoints: `/login`, `/otp/request` (purpose `LOGIN`),
`/refresh` (rotates tokens), and `/drivers/register`.
Passwords are sent only in login/registration requests and are not saved by API auth.
Access/refresh tokens are kept in sessionStorage, scoped to the browser tab.
Reload restores the session; logout removes the tokens. Auth uses JSON bearer tokens
without cross-origin cookie credentials. Protected business requests attach the access
token, refresh it before expiry, and retry HTTP 401 once. Concurrent refreshes share
one request. Failed refresh clears the local session; login is required again.

Roles come from the backend. DRIVER registration does not grant corporate or station
permissions. Corporate accepts CORPORATE_ADMIN, CORPORATE_MANAGER, CORPORATE_VIEWER;
partner accepts FUEL_STATION_OWNER, STATION_OPERATOR, and STATION. STATION maps to
the frontend STATION_OPERATOR role; owner permissions require FUEL_STATION_OWNER.
The original backend role is preserved in stored tokens. No role is inferred from email.
Corporate companyId and partner stationIds are read from the returned user when present;
no demo company/stations are assigned to real accounts.

Still needed from the backend: corporate/partner registration, OTP verification,
forgot/reset/change password, and server logout/revocation. These flows show an
unavailable message until their API contracts are provided, except password recovery which offers the frontend preview described below. OTP requests show the
server expiry and resend delay; developmentOtp is never displayed as a verified code.

Run `npm.cmd run build` and `npm.cmd test` on PowerShell. API unit tests mock HTTP
responses; they do not register real users or send OTP messages.

## Password recovery UI preview

Open `/auth/forgot` to preview the email form, confirmation screen, reset-password
form and completion screen. `/auth/reset?preview=1` previews the reset form directly;
reset links also support `/auth/reset/:token` and `/auth/reset?token=...`.
The UI handles email validation, matching passwords, password visibility and missing links.
Preview labels stay visible throughout: no email is sent, no recovery API is called,
and no password is changed or persisted. Login, registration and OTP request retain
their existing API integrations.
