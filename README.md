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

```bash
pnpm install
cp backend/.env.example backend/.env   # then set DATABASE_URL and JWT_SECRET
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
is unavailable, the server fails instead of silently switching to temporary storage.

Administrators can view the current account list at `/users` and approve pending orders.
Employees can submit or cancel their own eligible orders and edit or delete their own
drafts. Administrators may manage any draft. Orders created before ownership was tracked
have no owner and are manageable only by administrators. Order status transitions are
Draft → Pending → Approved → Shipped → Delivered, with cancellation from Draft or
Pending; only administrators may approve, ship, or mark orders delivered. Missing or
invalid authentication returns 401; authenticated users lacking permission receive 403.

To grant administrator access, first have each person register, then independently verify
that the account belongs to the intended person. An operator with local database access
can promote an existing account (replace the placeholder with the verified email):

```bash
pnpm --filter supplyflow-backend admin:grant 'verified-email@example.com'
```

Repeat for each administrator. Names alone do not prove identity and public registration
does not verify email addresses. Never use an unverified account for this step. The script
uses `backend/.env`; keep this ignored file and its database credentials private. The users
list reflects the database; no employee list or passwords belong in source control.
