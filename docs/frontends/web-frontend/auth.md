# Auth

All auth UI and state lives under `src/auth/`. Forms validate against Zod schemas from `interfaces-shared-types` via `.safeParse()`, then call into `authApi`.

## Routes

- `/` → `AuthPage` (login / signup toggle)
- `/reset-password?token=…` → `ResetPasswordPage`

## Components

### `AuthPage`
Container that toggles between the login and signup forms via local state. Wraps both in the Amethyst card layout.

### `LoginForm`
Username-or-email + password form. Renders a "Forgot password?" button that opens `ForgotPassword` as a modal, and a "Sign up for access" link that switches to signup. On success calls `useAuth().login`, refreshes the CASL role, and navigates to `/`.

### `SignUpForm`
Five-field form (full name, email, organization, username, password) with inline hints on the username and password fields. On success calls `signUp`, which posts to the backend then auto-signs the new user in. Surface-level API errors are shown as toasts.

### `ForgotPassword`
Modal overlay launched from `LoginForm`. Accepts username or email, posts to `/api/auth/forgot-password`, then switches to a "check your inbox" confirmation state.

### `ResetPasswordPage`
Standalone page reached from the email link. Reads `token` from the URL query string, accepts a new password, posts to `/api/auth/reset-password`, then shows a "Password updated" state. Submit is disabled when no token is present.

## State

### `AuthContext` (`AuthProvider` + `useAuth`)
Holds `{ user, login, logout }`. On mount, hydrates `user` by decoding the JWT in `localStorage.id_token`. Auto-logs out via `setTimeout` when the token's `exp` is reached.

### `authApi`
Thin `fetch` wrapper exposing `signIn`, `signUp`, `forgotPassword`, `resetPassword`. Each function posts to its `/api/auth/*` endpoint and parses the response with the corresponding Zod schema. `signIn` also writes the returned token to `localStorage`.

### `authStorage`
Token utilities — `getToken`, `setToken`, `removeToken`, `decodeToken`, `isLoggedIn`, `getTokenRemainingSeconds`, `getRoles`. Token key is `id_token`.
