# Auth

All auth UI and state lives under `src/auth/`. Forms validate against Zod schemas from `interfaces-shared-types` via `.safeParse()`, then call into `authApi`.

## Routes

- `/auth/*` → `AuthPage` (login / signup toggle)
- `/oauth/callback` → `OAuthCallbackPage`
- `/reset-password?token=…` → `ResetPasswordPage`

## Components

### `AuthPage`

Container that toggles between the login and signup forms via local state. Wraps both in the Amethyst card layout.

### `LoginForm`

Username-or-email + password form with Google and GitHub alternatives. It opens `ForgotPassword` as a modal and switches to a two-factor challenge when the account requires a code or backup code. A successful login refreshes the authenticated session and navigates into the application.

### `SignUpForm`

Five-field form (full name, email, organization, username, password) with username and email availability checks. Password signup creates the account and signs it in; Google and GitHub signup use the same OAuth callback flow. Surface-level API errors are shown as toasts.

### `OAuthCallbackPage`

Consumes the fragment returned by the backend OAuth callback. It adopts a completed session, requests two-factor verification when required, confirms an account link, or presents a provider-specific error.

### `ForgotPassword`

Modal overlay launched from `LoginForm`. Accepts username or email, posts to `/api/auth/forgot-password`, then switches to a "check your inbox" confirmation state.

### `ResetPasswordPage`

Standalone page reached from the email link. Reads `token` from the URL query string, accepts a new password, posts to `/api/auth/reset-password`, then shows a "Password updated" state. Submit is disabled when no token is present.

## State

### `AuthContext` (`AuthProvider` + `useAuth`)

Holds the authenticated user and the login, two-factor completion, OAuth session adoption, and logout actions. On mount, it hydrates the user by decoding `localStorage.id_token` and clears expired or server-revoked sessions.

### `authApi`

Thin `fetch` wrapper exposing password authentication, two-factor completion, signup, availability checks, password recovery, OAuth start URLs, and logout. Responses are parsed with shared Zod schemas before session data is stored.

### `authStorage`

Token utilities — `getToken`, `setToken`, `removeToken`, `decodeToken`, `isLoggedIn`, `getTokenRemainingSeconds`, `getRoles`. Token key is `id_token`.
