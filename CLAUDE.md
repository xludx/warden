# Warden — Authentication Service

Centralized authentication, authorization, and API key management service for multiple applications.

## Stack

- **Runtime:** Bun 1.2.1
- **Framework:** ElysiaJS 1.2.8
- **Language:** TypeScript 5.x strict mode
- **Validation:** Zod
- **ORM:** Drizzle + PostgreSQL
- **Logging:** Pino
- **Auth:** jose (JWT), bcryptjs (passwords), @simplewebauthn/server (passkeys)

## Project structure

```
src/
  clients/         # External: OAuth provider interactions
  db/
    schema.ts      # Drizzle schema
    index.ts       # Connection
  errors/          # Service error classes
  middleware/      # Auth, error handler, request ID
  routes/
    schema/        # Zod schemas per resource
    auth.ts        # Public auth endpoints
    admin.ts       # Admin CRUD endpoints
  services/        # Business logic
  util/            # env, jwt, logger, response-helpers
  index.ts         # Entry point
```

## Conventions

- Routes delegate to services. No business logic in handlers.
- Always pass Zod schemas as `body:`, `params:`, `query:` options.
- Throw `ServiceError` subclasses from services; `errorHandlerMiddleware` catches them.
- Use `successResponse()` / `listResponse()` for all responses.
- Log with Pino, never `console.log`.
- Access env vars only through `env` from `@/util/env`.
- Path alias: `@/` → `src/`.
- File naming: routes `kebab-case`, services `PascalCase`, schemas `kebab-case-schema.ts`.

## Key concepts

- **Application**: An app that uses Warden for auth. Has its own `jwt_secret`.
- **User**: A human or service account. Global across all apps.
- **Membership**: Links a human user to an application with a role.
- **Credential**: An auth method for a user (password, oauth, passkey).
- **API Key**: Scoped to user + app. Prefixed with app slug.
- **Service Grant**: Allows a service account to access a target app's APIs.
- **OAuth Provider**: Per-app config for Google/GitHub SSO.
