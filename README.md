# SupplyFlow

SupplyFlow is a full-stack supply chain management application designed to help small businesses manage inventory, suppliers, and purchase orders.

# Authors

Rohan Kumar and Patrick Tarumbwa

## Core Features

- Inventory management
- Supplier management
- Purchase order tracking
- Dashboard and low-stock alerts
- User authentication

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [UI Mockups](docs/supplyflow-mockups.png)
- [AI Development Instructions](AGENTS.md)

## Workspace Layout

This project uses pnpm workspaces: `frontend/` contains the React application, `backend/` contains the Express API, and `shared/` contains shared utilities. Project documentation is in `docs/`.

Run pnpm commands from the repository root; use workspace filters for package-specific scripts.

## Course

CS6983 - Generative AI, Northeastern University

## Running locally

Requires Node 20+, pnpm and PostgreSQL 16 or newer.
For a brand-new database, first follow the bootstrap steps under **Accounts and permissions**
to create and verify the two designated accounts before running the complete migration.

```bash
pnpm install
cp backend/.env.example backend/.env   # set DATABASE_URL, JWT_SECRET and admin emails
set -a
source backend/.env
set +a
pnpm --filter supplyflow-backend migrate
pnpm dev        # API on http://localhost:4000; UI on http://localhost:5173
```

`pnpm lint` and `pnpm test` run checks for every package. Set `TEST_DATABASE_URL` to also run the PostgreSQL model tests.
When using a Docker PostgreSQL container, start it before the app. Keep its data volume:
removing the volume removes the stored accounts and orders. If the container is named
`supplyflow-db`, restart it with `docker start supplyflow-db`.

### Accounts and permissions

Users can register at `/register` and sign in at `/login`. Registration always creates
an employee, never an administrator. Passwords are stored as bcrypt hashes. PostgreSQL
stores accounts and orders persistently. Without `DATABASE_URL`, the development server
uses temporary in-memory data that disappears when it restarts. If a configured database
is unavailable, production startup fails; development logs a warning before using temporary
in-memory data.

Administrators can view the current account list at `/users` and approve pending orders.
Employees can submit or cancel their own eligible orders and edit or delete their own
drafts. Administrators may manage any draft. Orders created before ownership was tracked
have no owner and are manageable only by administrators. Order status transitions are
Draft → Pending → Approved → Shipped → Delivered, with cancellation from Draft or
Pending; only administrators may approve, ship, or mark orders delivered. Missing or
invalid authentication returns 401; authenticated users lacking permission receive 403.

Only two designated accounts may be administrators. Before applying migration 004 to a new
database, create the users table and register or securely provision both accounts, independently
verify their identities, and set `ADMIN_EMAIL_1` and `ADMIN_EMAIL_2` in the ignored `backend/.env`.
The migration binds the existing account IDs to the policy; it refuses to proceed if either
account is missing or another admin already exists. On a fresh database, apply migrations 001–003
first to provision the accounts, then run `pnpm --filter supplyflow-backend migrate` for migration 004.
For example, after exporting `DATABASE_URL`, apply the first three files using `psql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/db/migrations/001_create_orders.sql \
  -f backend/db/migrations/002_create_users.sql \
  -f backend/db/migrations/003_order_owner.sql
```

Start the app, register both accounts as employees, verify ownership, and set both admin
emails in `backend/.env`. Export the settings and run the complete migration command. The
migration fixes which accounts may become admins; use `admin:grant` afterward to promote them.
Public registration never grants admin access based on an email address.

An operator can promote either designated account (replace the placeholder with its email):

```bash
pnpm --filter supplyflow-backend admin:grant 'verified-email@example.com'
```

Other accounts cannot be promoted by this script or a normal SQL role update. The database owner
can alter or bypass database rules, so database credentials must remain private. Names alone do not
prove identity and public registration does not verify email addresses. The demo seed creates
only an employee; it never creates an additional administrator.
