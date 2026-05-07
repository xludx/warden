# Warden

Centralized authentication, authorization, API key, and service-account management for multiple applications.

Warden exposes a Bun/Elysia API backed by PostgreSQL, plus a small React admin UI.

## Stack

- **Runtime:** Bun 1.2.x
- **API:** ElysiaJS
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** JWTs (`jose`), password hashes (`bcryptjs`), API keys
- **Logging:** Pino
- **Admin UI:** React + Vite + Tailwind

## Repository layout

```txt
src/
  db/              Drizzle schema and database connection
  errors/          Service error classes
  middleware/      request id, error handling, auth guards
  routes/          Elysia route groups and Zod schemas
  services/        business logic
  util/            env, jwt, logger, response helpers
  scripts/         operational scripts
admin/             React admin interface
drizzle/          generated migrations
```

## Concepts

- **Application** — an app that delegates auth to Warden. Each app has its own JWT secret.
- **User** — a human or service account, global across all applications.
- **Membership** — links a human user to an application with a role: `admin`, `editor`, or `viewer`.
- **Credential** — a login method for a user, currently password-first with schema room for OAuth/passkeys.
- **API key** — scoped to a user and application; stored as a SHA-256 hash.
- **Service account** — non-human user used by services.
- **Service grant** — permits a service account to request a token for a target application with scopes.
- **Audit event** — durable record of auth/admin actions.

## Environment

Create `.env` in the project root:

```env
PORT=3210
NODE_ENV=development
DATABASE_URL=postgres://warden:warden_dev@localhost:5433/warden
JWT_SECRET=replace-with-at-least-32-characters
BCRYPT_ROUNDS=12

# Optional WebAuthn/passkey config, not fully wired yet
PUBLIC_URL=http://localhost:3210
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Warden
WEBAUTHN_ORIGIN=http://localhost:3210
```

`JWT_SECRET` is the Warden-level fallback/utility secret. Application JWTs are signed with each application's `jwt_secret` from the database.

## Quick start with Docker

```bash
docker compose up --build
```

Services:

- API: <http://localhost:3210>
- Admin UI production container: <http://localhost:3211>
- Admin UI dev override: <http://localhost:3212>
- PostgreSQL: `localhost:5433`

Run migrations and create the first admin:

```bash
bun run db:migrate
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-me-now' bun run db:seed
```

The seed script creates the built-in `warden` application and makes the user a Warden admin.

## Local development

Install API dependencies:

```bash
bun install
```

Start PostgreSQL via Docker, then run the API directly:

```bash
docker compose up db
bun run db:migrate
bun run dev
```

Run the admin UI locally:

```bash
cd admin
npm install
npm run dev
```

## Scripts

API package scripts:

```bash
bun run dev          # watch src/index.ts
bun run start        # run API once
bun run db:generate  # generate Drizzle migration
bun run db:migrate   # apply migrations
bun run db:seed      # seed Warden app + superadmin; requires ADMIN_EMAIL/PASSWORD
```

Admin package scripts:

```bash
npm run dev
npm run build
npm run preview
```

## API overview

All responses follow:

```json
{ "success": true, "data": {} }
```

Errors follow:

```json
{ "success": false, "error": "message" }
```

### Public auth endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Register a human user for an application |
| `POST` | `/api/auth/login` | Login with email/password and get a JWT |
| `POST` | `/api/auth/token` | OAuth2-style client credentials flow for service accounts |
| `POST` | `/api/auth/verify` | Verify an API key for backend-to-backend auth |

### Protected user endpoints

Require either `Authorization: Bearer <jwt>` or `x-api-key: <key>`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/api-keys` | Create an API key |
| `GET` | `/api/auth/api-keys` | List current user's API keys for the authenticated app |
| `DELETE` | `/api/auth/api-keys/:id` | Revoke an API key |

### Admin endpoints

Require a Bearer token for the `warden` application and an `admin` membership.

- `/api/admin/applications`
- `/api/admin/users`
- `/api/admin/users/:id/memberships`
- `/api/admin/service-accounts`
- `/api/admin/service-accounts/:id/grants`
- `/api/admin/api-keys`
- `/api/admin/audit`

## Example flows

### Login

```bash
curl -s http://localhost:3210/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-now","appId":"warden"}'
```

Use the returned token for admin calls:

```bash
curl -s http://localhost:3210/api/admin/applications \
  -H "authorization: Bearer $TOKEN"
```

### Create an application

```bash
curl -s http://localhost:3210/api/admin/applications \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Example App","slug":"example-app"}'
```

### Register a user for an app

```bash
curl -s http://localhost:3210/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","password":"correct-horse-battery","appId":"example-app"}'
```

`appId` can be an application id or slug where supported by the service layer.

## Notes

- Keep business logic in `src/services/*`; routes should only validate and delegate.
- Use `env` from `@/util/env`, never `process.env` in application code.
- Use Pino via `@/util/logger`, never `console.log` outside one-off scripts.
- API keys are only returned once at creation time.
