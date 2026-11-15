# SupplyFlow Agent Instructions

Rules for AI coding agents (and humans) working in this repository. Keep changes small, tested
and consistent with the code that already exists. When this file and the code disagree, the
code wins: say so, then update this file.

## Project Context

- Full-stack supply chain app (CS6983 P2): React 18, Vite 5, Tailwind 3, Node 20, Express 4,
  PostgreSQL 16 (Neon in production), JWT, bcrypt. pnpm 12.18.0 workspaces.
- Requirements: `docs/PRD.md` (US-01 – US-10), transcribed from
  `docs/Project_Req_Documents.pdf`. **Never invent features.** Mockups:
  `docs/supplyflow-mockups.png`: an enterprise dashboard with sidebar navigation, summary
  cards, searchable tables and modal forms.
- Hosting: Vercel serves `frontend/` and rewrites `/api/*` to the Render API
  (`frontend/vercel.json`). Setup and operations: `docs/DEPLOYMENT.md`.

## Layout

```text
frontend/   React app. src/pages, src/components (Layout, MetricCard, OrderForm, VendorForm,
            StatusBadge, RoleGate, ProtectedRoute, Modal), src/services (API clients; shared
            request helper in apiClient.js), src/context/AuthContext.jsx
backend/    Express API, layered routes -> controllers -> services -> models
            app.js        createApp(deps): mounts routes, health, docs, error handling
            bootstrap.js  resolveDependencies(env): PostgreSQL or in-memory models, JWT secret
            server.js     entry point
            docs/         openapi.js builds the spec from @openapi comments in app.js + routes/
            db/           migrate.js, seed.js, grantAdmin.js, migrations/*.sql, seeds/
            tests/        unit/, integration/ (*.api.test.js Supertest, *.db.test.js PostgreSQL),
                          helpers/ (in-memory models, also used by bootstrap's in-memory mode)
shared/     Rules used by both sides: orderRules.js, vendorRules.js, usLocations.js
data/       Sample vendors.csv and orders.csv (140 each) for the seed and in-memory mode
e2e/        Playwright tests (+ playwright.config.js at the root)
docs/       PRD, mockups, diagrams, DEPLOYMENT.md, AI-WORKFLOW.md, Partner-Log.md
```

## Commands (from the repository root)

| Command                                                         | What it does                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev:api` / `pnpm dev:web` / `pnpm dev`                    | API on :4000 (loads `backend/.env`), Vite on :5173 (proxies `/api`), or both           |
| `pnpm lint`                                                     | ESLint, all packages                                                                   |
| `pnpm test`                                                     | Vitest in backend and frontend (unit + integration; DB tests need `TEST_DATABASE_URL`) |
| `pnpm test:e2e`                                                 | Playwright, Chromium, against its own in-memory API on :4100 and Vite on :5174         |
| `pnpm --filter supplyflow-backend test:coverage`                | Backend coverage (80% threshold on `services/`)                                        |
| `cd backend && node --env-file=.env db/migrate.js`              | Apply migrations (the `migrate` script loads no env file)                              |
| `pnpm --filter supplyflow-backend seed` / `admin:grant <email>` | Demo data / promote a designated admin (both load `backend/.env`)                      |

Without `DATABASE_URL` (outside production) the API runs in **in-memory mode**: the sample
vendors and orders, no users, and nothing persists.

## Decisions

- **Auth:** JWT (`sub` + `role`, 8 h) in `Authorization: Bearer`. The role is re-read from the
  database on each request. Registration always creates an `employee`. 401 = not logged in,
  403 = not allowed.
- **Two fixed administrators:** migration `004_fixed_admins.sql` binds exactly two existing
  accounts (`ADMIN_EMAIL_1`, `ADMIN_EMAIL_2`, read at migrate time) into `admin_identities`, and
  triggers block any other admin. Promote them with `db/grantAdmin.js`. Never add another path
  to the admin role.
- **Vendors:** `id`, `name`, `email` (unique, lowercase), `phone` (10 digits), `city`, `state`
  (US code), `status` (`Active`/`Inactive`). Deactivate, never delete. Admin-only writes. Reuse
  `shared/vendorRules.js` and `shared/usLocations.js`.
- **Orders (as built):** `order_id`, `vendor_id`, `order_amount`, `customer_name`,
  `customer_city`, `customer_state`, `customer_phone` (US only), `status`, `created_by`,
  `created_at`, `updated_at`. **Not built yet** (PRD US-06): `order_items`, a server-calculated
  total and `expected_delivery_date`. Don't assume they exist.
- **Ownership:** `created_by` (migration `003_order_owner.sql`). Employees may edit, delete,
  submit or cancel only their own orders; admins may act on any. Legacy orders with no owner are
  admin-only.
- **Active-vendor check:** creating an order, or changing its vendor, requires an existing
  Active vendor. This is checked in `orderService` and again in the SQL.
- **Status:** Draft → Pending (creator) → Approved → Shipped → Delivered (admin only). Cancel from
  Draft or Pending (creator or admin). Delivered and Cancelled are final. Rules live in
  `shared/orderRules.js`. An invalid move is a 400, checked before the role (403).
- **Routes:** `/api/auth/{register,login,me}`, `/api/users` (admin),
  `/api/vendors[/:id]` (`PUT` to update or deactivate), `/api/orders[/:id]`,
  `PATCH /api/orders/:id/status`, `/api/dashboard`, `/api/health`.
- **Dashboard** is the home page at `/` (after login). `GET /api/dashboard` returns the metrics.
  Overdue deliveries is `null` until orders have an expected delivery date.
- **API docs:** Swagger UI at `/api/docs`, JSON at `/api/docs.json`, built from `@openapi`
  comments. Every endpoint must have one (request body, responses, `bearerAuth` when login is
  required). A YAML error in a comment fails startup and the tests.
- **CI/CD** (`.github/workflows/`): lint → unit/integration tests (PostgreSQL 16 service) →
  frontend build → Playwright E2E, plus `pnpm audit` (production dependencies, high/critical),
  dependency review and CodeQL. Pull requests get a Vercel preview. A push to `master` that
  passes every stage deploys Render, then Vercel.
- **Ownership of areas:** Patrick: auth, vendors, dashboard, Swagger, CI/CD, deployment, README.
  Rohan: orders, status workflow, order ownership, fixed administrators, diagrams.

## Testing Rules

- **TDD:** commit the failing tests first (`test(scope): add failing tests … (#issue)`), then
  the implementation (`feat`/`fix`) in a separate commit. Show the tests failing for the right
  reason before implementing.
- Use Vitest + Supertest (backend), React Testing Library (frontend) and Playwright (`e2e/`).
  Prefer accessible selectors (role, label, name).
- **E2E never touches a real database.** Playwright starts `node backend/server.js` with
  `DATABASE_URL=''` and `IN_MEMORY_DEMO_USERS=true`. Bootstrap refuses that option in production
  or when `DATABASE_URL` is set. Never point Playwright at a dev or production server.
- `*.db.test.js` create and drop tables: run them only against a disposable
  `TEST_DATABASE_URL`, never against a database you care about.
- Don't change other people's tests to make your code pass. If a test is wrong, say why and fix
  only the test.
- Run `pnpm lint` and `pnpm test` (and `pnpm test:e2e` for UI flows) before committing.

## Security Rules

- No secrets in git: `.env*` files are ignored (except `backend/.env.example`), and
  `.vercelignore` keeps them out of Vercel uploads. Use placeholders in docs. Never print
  secret values in logs, tests or chat.
- Parameterized SQL only (`$1`, `$2`, …). Never build SQL from strings.
- Hash passwords with bcrypt. Validate input on the server (shared rules) even when the UI
  validates.
- Check auth and role in the API. Hiding a control in the UI is not access control.
- Production fails fast without `DATABASE_URL` or `JWT_SECRET`. Keep it that way.

## Git Workflow

- Branches: `feature/<issue#>-description` (also `fix/`, `docs/`, `test/`, `ci/`).
- Commits: `type(scope): summary (#issue)`, e.g. `feat(orders): add approval (#8)`.
- PRs include `Closes #<issue>`, pass CI, get partner review, and say what was AI-assisted.
  Move the board card to In Review when you open one.
- Reference issues in code as `// TODO(#12): ...`.

## How to Work with AI on This Repo

- **Give context, not just a task:** point the agent at this file, the relevant user story in
  `docs/PRD.md` and the files it should change.
- **Work in two steps:** step 1, "write failing tests only, then stop" (review them); step 2,
  "implement until they pass".
- **Fence the scope:** say what must not change ("don't modify order code", "test only", "don't
  commit"). Agents must stay inside that scope and ask before crossing it.
- **Verify, don't trust:** agents must check commands, paths, env vars and behavior against the
  code before stating them, and show real lint and test output. Humans review every diff before
  committing.
- How we used AI on this project, and what we learned: `docs/AI-WORKFLOW.md`.
