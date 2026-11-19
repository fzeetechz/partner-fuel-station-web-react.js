# Station Authentication and Shared Account APIs

The station portal uses live authentication and business APIs. Configure `VITE_API_BASE_URL` for the API root and, optionally, `VITE_AUTH_API_BASE_URL` for the public authentication root. The default authentication URL derives from the configured API URL.

## Sign-in and session lifecycle

| Endpoint | Behavior |
| --- | --- |
| `POST /public/auth/login` | Email/password login. Accepts active station accounts only in this portal. |
| `POST /public/auth/refresh` | Rotates tokens and updates the current tab session. |
| `GET /shared/profile` | Loads the authenticated account profile. |
| `PATCH /shared/profile` | Saves name/language/photo; the API also supports notification-client push registration. |
| `POST /shared/auth/logout` | Revokes the current session and clears local credentials. |
| `POST /shared/profile/password` | Changes the password and signs out after successful server confirmation. |

The actual backend role `STATION` is accepted and mapped to the existing frontend station role. Its backend role remains in the token metadata. Station assignment is read from `user.station`, including populated `{ _id, unitId }` objects. Legacy owner/operator roles remain compatible; valid `STATION` users can reach the station endpoints provided by the backend without an invented owner-only UI restriction.

Tokens remain in sessionStorage for the current tab. Passwords and dispensing PINs are never persisted. Local storage saves appearance preferences. Refreshes are shared across concurrent requests and applied only if the original session is still current. Temporary network failures preserve refresh credentials; invalid/revoked refreshes clear them. Protected requests retry a genuine access-token 401 once. `401 INVALID_CREDENTIALS` from a wrong current password or PIN-password check is shown without forcing a token refresh or sign-out.

## Phone verification and password recovery

| Endpoint | Use |
| --- | --- |
| `POST /public/auth/otp/request` | `LOGIN` code for registered phone verification or `RESET` code for password recovery. |
| `POST /shared/profile/verify-phone` | Verifies the signed-in account phone using its LOGIN code. |
| `POST /public/auth/password/reset` | Resets a verified-phone account using its RESET code and new password. |
| `POST /shared/profile/pin` | Sets a six-digit POS PIN using the current account password. |

The recovery UI follows server expiry/resend timing, validates confirmation, and clears the local session after a successful reset. Development OTP values are displayed only in development builds when the server supplies them.

`POST /public/auth/otp/verify` is registered and checked, but returns **403 for staff accounts**: station staff must use password login. It is not offered as a station sign-in method. `POST /public/auth/drivers/register` is retained as a separate public service contract; the station portal does not display driver signup or treat driver registration as partner access.

## POS security

Heartbeat, authorization verification and fuel dispensing require an administrator-issued `X-Device-Token`. The browser keeps this value only in component memory. Dispensing additionally requires the operator PIN. The confirmation step displays quantity and mileage while concealing the PIN. An uncertain dispensing response can be retried unchanged with the original idempotency key; persisted retry state contains only a digest and random key.

## Other shared services

The workspace uses live wallet/ledger, notification read state, support, private file upload/download and order-message APIs. Support status changes are reserved for administrators. Customer payment creation is not available to STATION accounts. The station can retrieve its order messages; read receipts are restricted to participants, and sending follows assignment, order status and server permissions.

See [the endpoint verification report](docs/STATION_API_VERIFICATION.md) for successful responses, guarded cases and test boundaries. Real-account business records were left unchanged; write tests used isolated QA accounts.
