# SupplyFlow

SupplyFlow is a full-stack supply chain web application. It gives a company one place to manage
its **vendors** and **purchase orders**, move each order through an approval and delivery
workflow, and watch purchasing activity on a **dashboard**.

**The problem it solves:** many small and mid-sized businesses track vendors and purchasing in
spreadsheets, email threads and disconnected tools. Nobody can see at a glance which orders are
waiting for approval, which vendors are still active, or how much has been spent. SupplyFlow
replaces that with a single, role-aware application where employees raise orders and
administrators review, approve and track them to delivery.

|                       | Link                                          |
| --------------------- | --------------------------------------------- |
| Live app              | https://supplyflow-rho.vercel.app             |
| API                   | https://supplyflow-pdiw.onrender.com          |
| API docs (Swagger UI) | https://supplyflow-pdiw.onrender.com/api/docs |

> The API runs on Render's free plan and sleeps when idle. The first request after a quiet
> period can take up to a minute; later requests are fast.

Built for **CS6983 – Generative AI, Northeastern University** (Project 2: Full-Stack Application)
by Rohan Kumar and Patrick Tarumbwa.

## Contents

- [Features](#features)
- [Roles and the fixed administrators](#roles-and-the-fixed-administrators)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Quick start (local development)](#quick-start-local-development)
- [Testing, linting and CI](#testing-linting-and-ci)
- [API overview](#api-overview)
- [Development workflow](#development-workflow)
- [Team](#team)
- [Further documentation](#further-documentation)

## Features

Features follow the user stories in the [Product Requirements Document](docs/PRD.md).

### Authentication

- **US-01 Secure login.** Users sign in with email and password at `/login`. The API checks the
  password against a bcrypt hash and returns a JWT (valid for 8 hours) that the app sends as
  `Authorization: Bearer <token>`. Every page except Login and Register requires a session, and
  users sign out with **Logout**. New users can create an account at `/register`.
- **US-02 Role-based access.** There are two roles, **Admin** and **Employee** (see
  [below](#roles-and-the-fixed-administrators)). The API returns **401** when a request has no
  valid token and **403** when the user's role or ownership doesn't allow the action. The UI
  hides controls a user can't use.

### Vendor management

- **US-03 Add vendor.** Admins add vendors (name, email, phone, city, state, status) in a modal
  form. Fields are validated on both the client and the server: phones must have 10 US digits,
  states are US codes, and vendor emails are unique.
- **US-04 Edit and deactivate vendors.** Admins edit vendor details or set a vendor to
  **Inactive**. Vendors are never deleted, so existing orders keep their vendor. Inactive vendors
  can't receive new orders.
- **US-05 Search and view vendors.** Everyone can browse the vendor table, search by name, filter
  by status, and open a vendor's details.

### Purchase orders

- **US-06 Create orders.** Any user can add an order for an **Active** vendor with an order amount
  and a US customer (name, phone, city, state or territory). New orders start as **Draft** and
  record who created them.
- **US-07 Edit or cancel orders.** The creator (or an admin) can edit or delete a **Draft** order
  and can cancel a Draft or Pending order. Delivered and Cancelled orders are final.
- **US-08 Approve orders.** Employees submit their Draft orders for approval (**Pending**); only
  admins can approve a Pending order (**Approved**).
- **US-09 Track orders.** Everyone can view and filter orders by status and sort them by amount.
  Admins move approved orders to **Shipped** and **Delivered**. Invalid status changes are
  rejected with **400**, and the table updates without a page reload.

The status workflow, shared by the API and the UI (`shared/orderRules.js`):

```mermaid
stateDiagram-v2
  [*] --> Draft: create
  Draft --> Pending: submit (creator)
  Pending --> Approved: approve (admin)
  Approved --> Shipped: ship (admin)
  Shipped --> Delivered: deliver (admin)
  Draft --> Cancelled: cancel (creator or admin)
  Pending --> Cancelled: cancel (creator or admin)
  Delivered --> [*]
  Cancelled --> [*]
```

> **Not built yet:** the PRD also describes order line items (products, quantities and unit
> prices) with an automatically calculated total, and an expected delivery date. Orders currently
> store a single order amount instead, so the dashboard shows "Overdue deliveries" as _Not
> tracked yet_.

### Dashboard

- **US-10 Dashboard metrics.** After login, users land on a dashboard with summary cards for
  total orders, pending orders, active vendors, total spending (excluding cancelled orders) and
  overdue deliveries, plus order counts by status and the five most recent orders. The metrics are
  loaded fresh each time the dashboard opens, so they reflect the latest order and vendor changes.

## Roles and the fixed administrators

| Capability                                                                                   | Employee | Admin |
| -------------------------------------------------------------------------------------------- | :------: | :---: |
| View dashboard, vendors and orders                                                           |    ✅    |  ✅   |
| Create orders; edit, delete or submit **own** Drafts; cancel **own** Draft or Pending orders |    ✅    |  ✅   |
| Edit, delete, submit or cancel **anyone's** eligible orders                                  |          |  ✅   |
| Approve, ship and deliver orders                                                             |          |  ✅   |
| Add, edit and deactivate vendors                                                             |          |  ✅   |
| View the user list (`/users`)                                                                |          |  ✅   |

**How administrators work.** Registration always creates an **Employee**. There is no way to
sign up as an admin. SupplyFlow allows exactly **two designated administrator accounts**, enforced
by the database itself (migration `backend/db/migrations/004_fixed_admins.sql`):

1. The two accounts first register normally, as employees.
2. An operator sets `ADMIN_EMAIL_1` and `ADMIN_EMAIL_2` to those accounts' emails and runs the
   migrations. Migration 004 records the two accounts in an `admin_identities` table, which
   database triggers then lock against changes.
3. The operator promotes each account with the `admin:grant` script.

After that, the database rejects any attempt to make a different account an admin, even a direct
SQL update. It also blocks changing a designated admin's email. The step-by-step commands are in
the [Deployment guide](docs/DEPLOYMENT.md#6-create-the-two-administrators).

**Demo accounts.** The live site has a demo employee account and the two administrator accounts.
Their passwords are not published in this repository. The team shares demo credentials privately
with graders and reviewers. Anyone can also register a new employee account on the live site.

## Tech stack

| Layer    | Technology                                                       |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 18, React Router 7, Vite 5, Tailwind CSS 3                 |
| Backend  | Node.js 20, Express 4                                            |
| Database | PostgreSQL 16 (Neon in production), `pg` driver                  |
| Auth     | JWT (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`)       |
| API docs | OpenAPI 3 via `swagger-jsdoc` and `swagger-ui-express`           |
| Testing  | Vitest, Supertest, React Testing Library                         |
| Tooling  | pnpm workspaces, ESLint, Prettier                                |
| CI       | GitHub Actions (lint and tests on every PR and push to `master`) |
| Hosting  | Vercel (frontend), Render (API), Neon (database)                 |

## Architecture

```mermaid
flowchart LR
  B["Browser<br/>(React app)"] -->|"pages and assets"| V["Vercel<br/>static frontend"]
  B -->|"/api/* requests"| V
  V -->|"rewrite /api/*"| R["Render<br/>Express API (Node 20)"]
  R -->|"SQL over TLS<br/>(pooled connection)"| N[("Neon<br/>PostgreSQL 16")]
```

- The browser only talks to the Vercel domain. `frontend/vercel.json` rewrites every `/api/*`
  request to the Render API and serves `index.html` for all other paths, so the app needs no
  CORS setup and client-side routes like `/orders` work on refresh.
- The API is layered `routes → controllers → services → models`. Business rules such as
  validation, the status workflow and ownership checks live in the services and in `shared/`, which
  the frontend reuses.
- Diagrams: [architecture](docs/architecture-diagram.png) ·
  [database schema](docs/database-schema-diagram.png).

## Project structure

```text
SupplyFlow/
├── frontend/            React app (Vite)
│   ├── src/pages/       Login, Register, Dashboard, Orders, Vendors, Users
│   ├── src/components/  Layout, MetricCard, OrderForm, VendorForm, StatusBadge, RoleGate, …
│   ├── src/services/    API clients (authApi, orderApi, vendorApi, dashboardApi)
│   └── vercel.json      Vercel rewrites (/api → Render, SPA fallback)
├── backend/             Express API
│   ├── routes/          Endpoints + @openapi comments (the source of /api/docs)
│   ├── controllers/     HTTP in/out
│   ├── services/        Business rules
│   ├── models/          PostgreSQL queries (parameterized SQL)
│   ├── middleware/      requireAuth, requireRole, error handling
│   ├── db/              migrate.js, seed.js, grantAdmin.js, migrations/, seeds/
│   ├── docs/openapi.js  Builds the OpenAPI spec
│   ├── tests/           Vitest unit + Supertest integration + PostgreSQL tests
│   └── .env.example     Environment variable template
├── shared/              Rules used by both sides (orderRules, vendorRules, usLocations)
├── data/                Sample vendors and orders (CSV) used by the seed and in-memory mode
├── docs/                PRD, mockups, diagrams, partner log, deployment guide
├── render.yaml          Render blueprint for the API
└── AGENTS.md            Rules for AI coding agents working in this repo
```

## Quick start (local development)

### Prerequisites

- **Node.js 20.6 or newer.** The scripts use `node --env-file`.
- **pnpm 12.18.0.** CI uses this version. Install it with `npm install -g pnpm@12.18.0`, or prefix
  commands with `npx pnpm@12.18.0`.
- **PostgreSQL 16** _(optional)_. Without it, the API runs in
  [in-memory mode](#no-database-in-memory-mode).

### 1. Install and configure

```bash
pnpm install
cp backend/.env.example backend/.env
```

Edit `backend/.env`. It is git-ignored; never commit it.

| Variable                         | Used by                         | Purpose                                                                              |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                           | API                             | Port to listen on (default `4000`)                                                   |
| `DATABASE_URL`                   | API, migrate, seed, admin:grant | PostgreSQL connection string. Leave empty for in-memory mode                         |
| `JWT_SECRET`                     | API                             | Secret that signs login tokens. Use a long random value, e.g. `openssl rand -hex 32` |
| `ADMIN_EMAIL_1`, `ADMIN_EMAIL_2` | migrate                         | The two designated administrator emails (see below)                                  |
| `SEED_EMPLOYEE_PASSWORD`         | seed                            | Password for the demo employee `employee@supplyflow.com`                             |
| `TEST_DATABASE_URL`              | tests                           | Optional: a **separate, disposable** database for the PostgreSQL tests               |

### 2. Create the database tables

Migrations live in `backend/db/migrations/`. Every migration is safe to re-run. The migrate
script doesn't load `.env` by itself, so run it with `--env-file` from `backend/`:

```bash
cd backend
node --env-file=.env db/migrate.js
```

**On a brand-new database this first run stops at migration 004.** That's expected:
migrations 001–003 have created the tables, but the two administrator accounts don't exist yet.
Then:

1. Start the app (step 3) and register the two administrator accounts at
   http://localhost:5173/register.
2. Put their emails in `ADMIN_EMAIL_1` and `ADMIN_EMAIL_2` in `backend/.env`.
3. Run the migration again: `node --env-file=.env db/migrate.js`. All five files apply.
4. Promote each account from the repository root:

   ```bash
   pnpm --filter supplyflow-backend admin:grant admin-one@example.com
   pnpm --filter supplyflow-backend admin:grant admin-two@example.com
   ```

   Then log out and back in to see the admin controls.

Optionally, load the demo data: 140 vendors and 140 orders from `data/`, plus the demo
employee, whose password is `SEED_EMPLOYEE_PASSWORD`. Run this from the repository root:

```bash
pnpm --filter supplyflow-backend seed
```

### 3. Run the app

From the repository root:

```bash
pnpm dev:api   # API at http://localhost:4000 (restarts on file changes)
pnpm dev:web   # App at http://localhost:5173 (proxies /api to the API)
# or both at once:
pnpm dev
```

Open http://localhost:5173. The Swagger UI is at http://localhost:4000/api/docs.

### No database? In-memory mode

When `DATABASE_URL` is empty, or the database can't be reached outside production, the API
logs a warning and runs on **in-memory data**: the 140 sample vendors and orders from `data/`
and **no user accounts**. Register an account to log in. Everything, including registered users,
is lost when the API restarts. If `JWT_SECRET` is also empty, a random one is generated, so
logins end on restart.

`pnpm dev:api` still needs a `backend/.env` file to exist (it can be empty).

In production (`NODE_ENV=production`), the API refuses to start without a reachable
`DATABASE_URL` and a `JWT_SECRET`.

## Testing, linting and CI

```bash
pnpm lint    # ESLint across all packages
pnpm test    # Vitest in every package (backend + frontend)
pnpm --filter supplyflow-backend test:coverage   # backend coverage report (80% target on services)
```

- **Backend:**
  - Vitest unit tests for services and shared rules.
  - Supertest integration tests that call the Express app with in-memory models, covering every
    endpoint, the 401/403 rules and the status workflow.
- **Frontend:** Vitest and React Testing Library tests for pages, forms, route guards and
  role-based visibility.
- **PostgreSQL tests (`*.db.test.js`):** these run real SQL against a database and are
  **skipped** unless `TEST_DATABASE_URL` is set. They create and drop tables, so point it at a
  throwaway database, never your development or production database:

  ```bash
  TEST_DATABASE_URL=postgres://user:password@localhost:5432/supplyflow_test pnpm test
  ```

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and every push to `master`. It
  installs with `pnpm install --frozen-lockfile`, starts a PostgreSQL 16 service so the database
  tests run too, and then runs `pnpm lint` and `pnpm test`.

## API overview

Full, interactive documentation (request and response schemas, error codes, "Try it out"):
**https://supplyflow-pdiw.onrender.com/api/docs**. The raw OpenAPI JSON is at `/api/docs.json`.

Use **Authorize** in Swagger UI with the token from `POST /api/auth/login`.

| Method | Endpoint                       | Who can call it                                                   |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| GET    | `/api/health`                  | Public                                                            |
| GET    | `/api/docs`, `/api/docs.json`  | Public                                                            |
| POST   | `/api/auth/register`           | Public (always creates an Employee)                               |
| POST   | `/api/auth/login`              | Public                                                            |
| GET    | `/api/auth/me`                 | Any logged-in user                                                |
| GET    | `/api/users`                   | Admin                                                             |
| GET    | `/api/vendors?search=&status=` | Any logged-in user                                                |
| POST   | `/api/vendors`                 | Admin                                                             |
| GET    | `/api/vendors/:id`             | Any logged-in user                                                |
| PUT    | `/api/vendors/:id`             | Admin (also used to deactivate)                                   |
| GET    | `/api/orders`                  | Any logged-in user                                                |
| POST   | `/api/orders`                  | Any logged-in user (vendor must be Active)                        |
| GET    | `/api/orders/:id`              | Any logged-in user                                                |
| PUT    | `/api/orders/:id`              | Creator or admin; Draft orders only                               |
| DELETE | `/api/orders/:id`              | Creator or admin; Draft orders only                               |
| PATCH  | `/api/orders/:id/status`       | Submit or cancel: creator or admin. Approve, ship, deliver: admin |
| GET    | `/api/dashboard`               | Any logged-in user                                                |

Errors use one shape, `{ "error": { "message": "...", "details": [...] } }`, with these status
codes:

- 400: invalid input or an invalid status change
- 401: not logged in
- 403: not allowed
- 404: not found
- 409: conflict, such as a duplicate email or an order that is no longer a Draft

## Development workflow

- **Issues and board.** Work is tracked as GitHub issues on the project board, across two Agile
  sprints.
- **Branches.** Use `feature/<issue#>-description`, e.g. `feature/8-order-approval`. Use `fix/…`
  and `docs/…` for fixes and documentation.
- **Commits.** Use `type(scope): summary (#issue)`, e.g. `feat(orders): add approval (#8)`.
- **Pull requests.** Every PR includes `Closes #<issue>`, passes CI and gets a review from the
  other partner. PRs say when code was AI-generated.
- **Test-driven development.** For each feature, the failing tests are committed first; the
  implementation that makes them pass follows in a separate commit. Run `pnpm lint` and
  `pnpm test` before committing.
- **AI-assisted development.** [`AGENTS.md`](AGENTS.md) gives AI coding agents the project
  context: stack, layering, naming, security rules, requirements and mockup references, the
  status workflow and git conventions. The team used AI agents to write tests and implementation
  in small, reviewed steps, and reviewed and tested every change before merging.
- **Standards.** The project uses ES modules, Prettier and ESLint. Functions are camelCase,
  React components PascalCase and database tables snake_case. SQL is always parameterized and
  secrets live only in environment variables.

## Team

**Rohan Kumar** and **Patrick Tarumbwa**

| Area                                                                                                 | Built by |
| ---------------------------------------------------------------------------------------------------- | -------- |
| Purchase orders: create, edit, delete, status workflow, order tracking and filtering (US-06 – US-09) | Rohan    |
| Order ownership, the fixed-administrator policy and the Users page                                   | Rohan    |
| Demo order data, architecture and database diagrams                                                  | Rohan    |
| Authentication: login, registration, JWT, route guards (US-01, US-02)                                | Patrick  |
| Vendor management: API, UI, search and filters (US-03 – US-05)                                       | Patrick  |
| Dashboard metrics (US-10)                                                                            | Patrick  |
| CI workflow, Swagger/OpenAPI docs, deployment (Vercel, Render, Neon), README                         | Patrick  |
| Database integration and data population                                                             | Both     |

See the [Partner Log](docs/Partner-Log.md) for more detail.

## Further documentation

- [Deployment guide](docs/DEPLOYMENT.md): Neon, migrations, Render, Vercel, smoke test and
  troubleshooting
- [Product Requirements Document](docs/PRD.md)
- [UI mockups](docs/supplyflow-mockups.png)
- [Sample data](data/README.md)
- [AI development instructions](AGENTS.md)
