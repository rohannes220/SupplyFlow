# CLAUDE.md — SupplyFlow

Instructions for Claude Code (and other coding agents such as GitHub Copilot) working in this
repository. Read this file before every task. `AGENTS.md` holds the same rules in more detail;
if the two files disagree, the code wins. Say so, then fix both files.

## Imported context

- Requirements (user stories US-01 – US-10, acceptance criteria, data model): @docs/PRD.md
- Deployment, environment variables and operations: @docs/DEPLOYMENT.md
- How we use AI on this project: @docs/AI-WORKFLOW.md
- UI mockups (open when doing UI work): `docs/supplyflow-mockups.png`
- API docs at runtime: Swagger UI `/api/docs`, JSON `/api/docs.json` (built by `backend/docs/openapi.js`)

## Project context

SupplyFlow is a full-stack supply chain app (CS6983). Companies manage **vendors** and
**purchase orders**, track orders through an approval and delivery workflow, and view metrics
on a **dashboard**. There are two roles: `admin` and `employee`.

**Never invent features.** Build only what a user story in `docs/PRD.md` asks for. If a
request isn't covered by the PRD, stop and ask.

## Tech stack

| Layer    | Technology                                                                     |
| -------- | ------------------------------------------------------------------------------ |
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 7                               |
| Backend  | Node 20, Express 4, `pg`, `jsonwebtoken`, `bcryptjs`, `swagger-jsdoc`          |
| Database | PostgreSQL 16 (Neon in production); in-memory models when no `DATABASE_URL`    |
| Shared   | `shared/` workspace package `@supplyflow/shared` (validation and status rules) |
| Tests    | Vitest, Supertest, React Testing Library, Playwright (Chromium)                |
| Tooling  | pnpm workspaces, ESLint 9 (flat config), Prettier                              |
| CI/CD    | GitHub Actions, CodeQL; Vercel (frontend) + Render (API)                       |

## Commands (run from the repository root)

```bash
pnpm install                                     # install all workspaces
pnpm dev                                         # API :4000 + Vite :5173 (proxies /api)
pnpm lint                                        # ESLint, all packages
pnpm test                                        # Vitest, backend + frontend
pnpm test:e2e                                    # Playwright, own in-memory API :4100 + Vite :5174
pnpm --filter supplyflow-backend test:coverage   # 80% threshold on backend/services
pnpm format:check                                # Prettier
cd backend && node --env-file=.env db/migrate.js # apply SQL migrations
```

Without `DATABASE_URL` (outside production) the API runs in **in-memory mode** with the sample
data in `data/*.csv`. Nothing persists.

## Architecture

```text
frontend/src/
  pages/        One page per screen (Dashboard, Vendors, Orders, Users, Login, Register)
  components/   Layout, MetricCard, OrderForm, VendorForm, StatusBadge, RoleGate,
                ProtectedRoute, Modal
  services/     API clients; every request goes through apiClient.js
  context/      AuthContext.jsx (token + current user)
backend/
  app.js        createApp(deps): routes, health, docs, error handler
  bootstrap.js  resolveDependencies(env): PostgreSQL or in-memory models
  routes/ -> controllers/ -> services/ -> models/   (strict layering)
  db/           migrate.js, seed.js, grantAdmin.js, migrations/NNN_*.sql
  tests/        unit/, integration/ (*.api.test.js, *.db.test.js), helpers/
shared/         orderRules.js, vendorRules.js, usLocations.js
e2e/            Playwright specs
```

### Architecture decisions

- **Layering:** routes only wire URLs and middleware; controllers handle HTTP (status codes,
  request/response); services hold business rules; models hold SQL. Don't skip a layer.
- **Dependency injection:** `createApp(deps)` receives its models, which is how tests and
  in-memory mode swap PostgreSQL out. Don't import models directly into services or routes.
- **Shared rules:** validation and the status workflow live in `shared/` and run on both sides.
  The server always validates, even when the UI already did.
- **Auth:** JWT (`sub`, `role`, 8 h) in `Authorization: Bearer`. The role is re-read from the
  database on every request. Registration always creates an `employee`. 401 = not logged in,
  403 = not allowed.
- **Two fixed administrators:** migration `004_fixed_admins.sql` and DB triggers allow exactly
  two admin accounts, promoted with `db/grantAdmin.js`. Never add another path to the admin role.
- **Vendors:** `name`, `email` (unique, lowercase), `phone` (10 digits), `city`, `state` (US
  code), `status` (`Active`/`Inactive`). Deactivate, never delete. Writes are admin-only.
- **Orders (as built):** `order_id`, `vendor_id`, `order_amount`, `customer_name`,
  `customer_city`, `customer_state`, `customer_phone`, `status`, `created_by`, `created_at`,
  `updated_at`. **Not built yet:** `order_items`, server-calculated totals and
  `expected_delivery_date` (US-06). Don't assume they exist.
- **Ownership:** employees may edit, delete, submit or cancel only their own orders; admins may
  act on any. Orders with no owner are admin-only.
- **Active vendor:** creating an order or changing its vendor requires an existing Active
  vendor (checked in `orderService` and in SQL).
- **Status workflow:** Draft → Pending (creator) → Approved → Shipped → Delivered (admin).
  Cancel from Draft or Pending. Delivered and Cancelled are final. An invalid move is 400 and is
  checked before the role check (403).
- **Routes:** `/api/auth/{register,login,me}`, `/api/users` (admin), `/api/vendors[/:id]`,
  `/api/orders[/:id]`, `PATCH /api/orders/:id/status`, `/api/dashboard`, `/api/health`.

## Coding conventions

- ES modules everywhere (`import`/`export`), `async`/`await`, no callbacks.
- Prettier: single quotes, semicolons, trailing commas, 100-column lines. ESLint must pass.
- Naming: `camelCase` for variables and functions, `PascalCase` for React components and their
  files, `snake_case` for SQL columns. Backend files are named by role: `orderService.js`,
  `orderController.js`, `orderRoutes.js`.
- React: function components and hooks only; Tailwind classes, no new CSS files; accessible
  forms (every input has a `<label>`, buttons have names).
- Errors: services throw `AppError` subclasses from `backend/utils/errors.js` (for example
  `ValidationError`, 400); `backend/middleware/errorHandler.js` formats the response. Don't send raw database errors to the client.
- Every endpoint has an `@openapi` JSDoc comment (request body, responses, `bearerAuth` when
  login is required). A YAML mistake breaks startup and the tests.
- New tables or columns go in a new numbered file in `backend/db/migrations/`. Never edit a
  migration that has already been applied.

## Testing strategy

- **TDD (red → green → refactor).** Commit failing tests first
  (`test(scope): add failing tests for … (#issue)`), then the implementation in a separate
  `feat`/`fix` commit. Show the tests failing for the right reason before implementing.
- **Unit** (`backend/tests/unit`, Vitest): services, shared rules, middleware.
- **Integration** (`backend/tests/integration`): `*.api.test.js` use Supertest against
  `createApp` with in-memory models; `*.db.test.js` need a disposable `TEST_DATABASE_URL`
  because they create and drop tables.
- **Frontend** (`*.test.jsx` next to the component): React Testing Library; query by role,
  label or accessible name.
- **E2E** (`e2e/`, Playwright): runs against its own in-memory API (`DATABASE_URL=''`,
  `IN_MEMORY_DEMO_USERS=true`). Never point it at a dev or production server.
- Coverage: at least 80% on `backend/services`.
- Before every commit: `pnpm lint` and `pnpm test` (plus `pnpm test:e2e` for UI flows).

## Do's

- Do read the relevant user story in `docs/PRD.md` and the existing code (Glob, Grep, Read)
  before changing anything.
- Do plan first for anything bigger than a small fix, and keep each change to one issue.
- Do reuse `shared/` rules and `frontend/src/services/apiClient.js` instead of duplicating them.
- Do use parameterized SQL (`$1`, `$2`, …) and bcrypt for passwords.
- Do check auth and role in the API. Hiding a button in the UI is not access control.
- Do show real lint and test output, and check commands, paths and env vars against the code
  before writing them in docs.
- Do use branches `feature/<issue#>-description` (or `fix/`, `docs/`, `test/`, `ci/`) and
  commits `type(scope): summary (#issue)`.
- Do say in the PR when code was AI-assisted and include `Closes #<issue>`.

## Don'ts

- Don't invent features or fields that aren't in the PRD.
- Don't commit secrets. `.env*` is ignored (except `backend/.env.example`); use placeholders in
  docs and never print secret values in logs, tests or chat.
- Don't build SQL from strings or template literals.
- Don't delete vendors, and don't add new ways to become an admin.
- Don't edit or skip someone else's tests to make your code pass. If a test is wrong, say why
  and fix only the test.
- Don't remove the production fail-fast checks for `DATABASE_URL` and `JWT_SECRET`.
- Don't push to `master` or force-push shared branches. Don't commit unless asked.
- Don't run `*.db.test.js` against a database you care about.
