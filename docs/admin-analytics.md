# Admin analytics

The admin dashboard is available at `/admin` to accounts with `admin-role`. Both the React route and every admin API endpoint enforce this role; the backend is the security boundary.

## Creating the first administrator

No account is automatically chosen as an administrator. In particular, the first registered user and existing users are never promoted based on signup order. This prevents an arbitrary account from gaining access when the application already has a production user base.

Grant the role to an existing account from the repository root:

```bash
pnpm admin:grant -- <username-or-email>
```

Revoke it with:

```bash
pnpm admin:revoke -- <username-or-email>
```

The CLI refuses to revoke the final administrator. Role changes revoke that account's existing sessions so its next login receives a JWT with current roles. After the first administrator signs in, they can appoint other administrators from **Admin dashboard → Admin access**.

For production, set `ADMIN_BOOTSTRAP_EMAILS` to one or more exact, trusted account emails in the deployment's secret environment configuration. `ADMIN_BOOTSTRAP_USERNAMES` is also supported, but email is the recommended identifier. Only matching existing accounts are promoted when the backend starts; if neither variable is configured, nobody is promoted automatically. The one-time CLI command is an alternative when it is run against the intended production database.

## Configuration

- `ANALYTICS_IDLE_THRESHOLD_SECONDS` — inactivity threshold used by the browser tracker and reported by the dashboard; defaults to `120`.
- `ANALYTICS_AGGREGATION_INTERVAL_MS` — daily-rollup refresh interval; defaults to `300000` (five minutes).

Raw usage events expire after 180 days. Daily aggregates do not expire. The dashboard reports project types and workbook counts by technical element, alongside session identifiers and active/idle durations. Events do not record input values, keystrokes, or document contents.

## Attribution links

Create a separately named link for each investor, event, or outreach group. A link open creates a pseudonymous visitor record. If that visitor later creates an account through password signup, Google, or GitHub, the dashboard shows the attributed account under that link. Links can expire, be paused, copied, and resumed by an administrator.

Application API paths, redirects, and copied attribution links are relative to the current browser origin. The production hostname is therefore supplied by deployment and is not hardcoded in the application.
