# shared-sdk

Runtime SDK for OpenPRA apps and services. It provides:

- Auth utilities (`AuthService`) and simple JWT handling
- API helper (`ApiManager`) with typed helpers for users, auth, and validation
- Collaboration helpers (roles API)
- Invitations workflow (invites API)
- Predefined roles data

This library depends on types from `shared-types` and is consumed by both frontend and backend packages.

## Install

The SDK is part of the monorepo and referenced via path aliases. No extra install is needed when working inside the repo.

## Exports

- api
	- `ApiManager`
	- `AuthService`
	- `roles` API helpers
	- `invites` API helpers
- data
	- `predefinedRoles`

## Usage

Auth

```ts
import { AuthService } from "shared-sdk/lib/api/AuthService";

// store a token
AuthService.setEncodedToken("<jwt>");

// read role(s)
const roles = AuthService.getRole();
```

API Manager

```ts
import { ApiManager } from "shared-sdk/lib/api/ApiManager";

// login
await ApiManager.signInWithUsernameAndPassword("user", "pass");

// fetch users
const members = await ApiManager.getUsers();

// signup (then auto-signin on success)
await ApiManager.signup({
	username: "newuser",
	email: "new@user.com",
	firstName: "New",
	lastName: "User",
	password: "secret",
	roles: ["member-role"],
});

// update current user
await ApiManager.updateUser("123", JSON.stringify({ firstName: "Updated" }));

// get a user by id
const user = await ApiManager.getUserById("123");

// verify a password
await ApiManager.verifyPassword("user", "secret");

// use checkStatus to enforce 2xx responses
const response = await fetch(`/api/some-endpoint`);
ApiManager.checkStatus(response); // throws on non-2xx
```

Invites

```ts
import { UserInviteApi } from "shared-sdk/lib/api/invites/userInviteApi";

await UserInviteApi.inviteUser(
	{ username: "u", email: "e@x.com", firstName: "f", lastName: "l", password: "p", passConfirm: "p" },
	/* expiry ms */ 7 * 24 * 3600 * 1000,
	/* count */ 2,
);
```

## Run

Build the library:

```bash
pnpm nx build shared-sdk
```

Run unit tests:

```bash
pnpm nx test shared-sdk
```

## Notes

- Keep this package focused on runtime code only. Pure types live in `shared-types`.
- Avoid adding heavy dependencies; prefer native fetch and small utilities.

## Error handling and validation

- `ApiManager.checkStatus(response)` throws on non-2xx. Use it if you need a uniform guard.
- `ApiManager.signup(...)` resolves on success and throws when the backend returns an error status.
- Username/email validation:
	- `isValidEmailFormat(email)` checks format only. Backend validation is done via `validEmail(signup)`.
	- `validEmail(signup)` and `validUserName(signup)` resolve to boolean; errors are caught and return false.
- Debounced validators:
	- `checkEmail(cb)` debounces, first checking format, then calling backend.
	- `checkUserName(cb)` debounces username uniqueness checks.
