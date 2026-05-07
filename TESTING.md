# Testing and feature validation

Warden ships API and UI features together. A feature is not complete when the code compiles. It is complete when the backend contract, frontend behavior, and real user flow have all been verified.

## Principle

Use layered tests:

1. **API integration tests** prove the implemented route works against the database and returns the contract the UI expects.
2. **Frontend API/client tests or mocked browser tests** prove the UI handles success and failure response shapes safely.
3. **End-to-end browser tests** prove the user can complete the workflow across breakpoints and common states.

Mocked UI tests are useful, but they do not prove the real backend route works. API integration tests are required for create/update/delete features.

## Feature checklist

### Backend

- [ ] Success path returns the documented status code and JSON envelope.
- [ ] Validation failures return `400` with a safe error response.
- [ ] Auth failures return `401` or `403`.
- [ ] Domain errors return the expected status, for example `404` or `409`.
- [ ] Side effects are verified, including audit events.
- [ ] Unexpected errors are logged with request context and stack traces.
- [ ] The response shape matches what the frontend API client expects.

### Frontend

- [ ] Loading, empty, success, and error states are implemented.
- [ ] Errors are actionable and dismissible.
- [ ] Non-JSON and malformed server responses do not expose raw parse errors.
- [ ] Destructive actions use explicit confirmation and clear consequence copy.
- [ ] Keyboard and screen reader behavior are considered.

### End-to-end

- [ ] Happy path in Playwright.
- [ ] Error path in Playwright.
- [ ] Desktop, tablet, and mobile projects pass.
- [ ] Automated axe accessibility checks pass.
- [ ] At least one real API smoke test covers the full backend contract for the feature.

## Commands

Run the backend API integration tests against a running local API and database:

```bash
docker compose up -d --build api db
bun run test:api
```

Run the admin UI checks:

```bash
cd admin
npm run build
npm run test:e2e
```

Run the full local validation loop:

```bash
docker compose up -d --build api db
bun run test:api
cd admin && npm run build && npm run test:e2e
```

## API integration test expectations

API integration tests live under `tests/api`. They intentionally call the running HTTP API instead of only calling service methods. This catches route/middleware/response-shape bugs like:

- database write succeeds but audit logging crashes the request
- auth context is unavailable in the route handler
- route returns non-JSON on errors
- UI receives a status code that does not match the visible result

Use `API_BASE_URL` to target a different API instance:

```bash
API_BASE_URL=http://localhost:3210 bun run test:api
```

The tests seed only the minimum admin identity they need and clean up test applications with the `api-test-` slug prefix.
