# Auth

All endpoints are JSON-only. Request bodies are validated by `ZodValidationPipe` against schemas in `interfaces-shared-types`. Invalid bodies return `400` with `{ message, issues[] }`.

## `POST /api/auth/signup`

Create a new user account. Username and email must be unique (email compared case-insensitively).

- **Body** — `SignupRequest`: `{ fullName, email, organization, username, password }`
- **201** — `SignupResponse`: `{ id, username, email }`
- **409** — username or email already taken

## `POST /api/auth/login`

Authenticate with username **or** email + password. Returns either a JWT or a short-lived two-factor challenge.

- **Body** — `LoginRequest`: `{ identifier, password }` (`identifier` accepts username or email)
- **200** — `LoginResponse`: `{ token }` or `{ twoFactorRequired: true, challengeToken }`
- **401** — invalid credentials or unknown user

## `POST /api/auth/login/2fa`

Complete a pending password or OAuth login with a six-digit authenticator code or backup code.

- **Body** — `LoginTwoFactorRequest`: `{ challengeToken, code }`
- **200** — `LoginSuccess`: `{ token }`
- **401** — challenge or code invalid or expired

## `POST /api/auth/logout`

Revoke the authenticated JWT session. The route requires a bearer token and returns `{ detail: "Signed out" }`.

## `GET /api/auth/availability`

Check whether a proposed username or email address is already registered. The signup form uses this endpoint for field-level availability feedback.

## OAuth routes

- `GET /api/auth/oauth/:provider/start` begins a Google or GitHub login, signup, or account-link flow.
- `GET /api/auth/oauth/:provider/callback` exchanges the provider code and redirects to `/oauth/callback` with a session, two-factor challenge, or error result.

When a Google or GitHub identity is not linked yet, login intent creates the account after the provider supplies a verified email. Existing accounts with the same verified email are linked instead of duplicated.

## `POST /api/auth/forgot-password`

Issue a password-reset token and email it to the user. Always returns the generic success response — does not reveal whether the account exists.

- **Body** — `ForgotPasswordRequest`: `{ identifier }` (username or email)
- **200** — `ForgotPasswordResponse`: `{ detail }`

Side effects when the account exists: a SHA-256 token hash and 1-hour expiry are written to the user; the raw token is emailed via `EmailService` (Nodemailer + Resend SMTP) as `${APP_BASE_URL}/reset-password?token=<token>`.

## `POST /api/auth/reset-password`

Consume a reset token and set a new password. Token is single-use — successful reset clears `resetTokenHash` and `resetTokenExpiresAt`.

- **Body** — `ResetPasswordRequest`: `{ token, newPassword }`
- **200** — `ResetPasswordResponse`: `{ detail }`
- **401** — token invalid, expired, or already consumed

## Notes

- Passwords are hashed with **argon2**. Raw passwords are never stored or logged.
- JWTs are signed with `JWT_SECRET`; expiry is configured with `JWT_EXPIRES_IN`.
- Required env vars at startup: `MONGO_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`. The app fails hard at boot if email vars are missing.
