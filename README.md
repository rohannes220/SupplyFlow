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
Requires Node 20+, pnpm and PostgreSQL 16.

```bash
pnpm install
cp backend/.env.example backend/.env   # then set DATABASE_URL
export $(grep -v '^#' backend/.env | xargs)
pnpm --filter supplyflow-backend migrate
pnpm dev:api    # API on http://localhost:4000
pnpm dev:web    # UI on http://localhost:5173 (proxies /api to the API)
```

`pnpm lint` and `pnpm test` run checks for every package. Set `TEST_DATABASE_URL` to also run the PostgreSQL model tests.

New orders must reference an existing Active vendor. Editing a draft to use a different
vendor also requires that vendor to be Active; existing references are retained if a
vendor is later deactivated. The order form displays a field error for an invalid vendor.

## Deployment

The frontend is served by **Vercel**. The API and a PostgreSQL 16 database run on **Render**. Vercel forwards every `/api/*` request to Render (see `frontend/vercel.json`), so the browser only ever talks to one origin and no CORS setup is needed.

```
browser ──> Vercel (React build) ──/api/*──> Render web service (Express) ──> Render PostgreSQL
```

The API builds from the **repository root**, not `backend/`, because it imports the `shared/` workspace package.

### 1. Create the database and API on Render

**Option A: Blueprint (uses `render.yaml`)**

1. In Render, choose **New → Blueprint** and select this repository.
2. Render reads `render.yaml` and proposes `supplyflow-db` (PostgreSQL 16) and `supplyflow-api` (Node web service).
3. Enter values for `SEED_ADMIN_PASSWORD` and `SEED_EMPLOYEE_PASSWORD` when asked, then **Apply**.

**Option B: by hand**

1. **New → PostgreSQL**: PostgreSQL version 16. Note its **Internal Database URL**.
2. **New → Web Service** from this repository, with these settings:

| Setting | Value |
| --- | --- |
| Root Directory | *(leave empty: the repository root)* |
| Runtime | Node |
| Build Command | `npx --yes pnpm@12.18.0 install --frozen-lockfile --prod --filter supplyflow-backend...` |
| Start Command | `node backend/server.js` |
| Health Check Path | `/api/health` |

3. Set these environment variables on the web service:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `20` |
| `DATABASE_URL` | The database's **Internal Database URL** |
| `JWT_SECRET` | A long random value, e.g. from `openssl rand -hex 32` |
| `SEED_ADMIN_PASSWORD` | Password for `admin@supplyflow.com` (used only by the seed script) |
| `SEED_EMPLOYEE_PASSWORD` | Password for `employee@supplyflow.com` (used only by the seed script) |

Render sets `PORT` itself and the server listens on it. With `NODE_ENV=production` the API **refuses to start** without a reachable `DATABASE_URL` or a `JWT_SECRET`; it never falls back to in-memory data.

### 2. Create the tables and seed the production database

Run these from your own machine, using the database's **External Database URL** (Render → the database → **Connections**).

1. Create `backend/.env.production`. It's git-ignored, but never commit it:

   ```
   DATABASE_URL=<External Database URL>?sslmode=require
   SEED_ADMIN_PASSWORD=<same value as on Render>
   SEED_EMPLOYEE_PASSWORD=<same value as on Render>
   ```

2. From the `backend/` folder, create the tables, then load the demo data:

   ```bash
   node --env-file=.env.production db/migrate.js
   node --env-file=.env.production db/seed.js
   ```

`migrate.js` applies every file in `backend/db/migrations/` in order. Each one uses `CREATE ... IF NOT EXISTS`, so you can re-run it after adding a migration. `seed.js` creates the two demo accounts, the 140 vendors from `data/vendors.csv` and the 140 sample orders. It's safe to re-run: existing vendors and orders are kept. The demo account passwords are reset to the `SEED_*` values each time.

3. Check the API: open `https://<your-render-service>.onrender.com/api/health`. It should return `{"status":"ok"}`.

### 3. Deploy the frontend on Vercel

1. In `frontend/vercel.json`, replace `RENDER_URL_PLACEHOLDER` with your Render host, e.g. `supplyflow-api.onrender.com` (no `https://`, no trailing slash). Commit and push.
2. In Vercel, **Add New → Project**, import this repository, and use these settings:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Install Command | `npx --yes pnpm@12.18.0 install --frozen-lockfile` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | 20.x |
| Include files outside the Root Directory | Enabled (the build imports `shared/`) |

No environment variables are needed on Vercel. The `/api` rewrite in `vercel.json` sends API calls to Render. The second rewrite serves `index.html` for app routes such as `/vendors`, so reloading those pages works.

### 4. Smoke test

1. Open the Vercel URL. You should see the login page.
2. Log in as `admin@supplyflow.com` with `SEED_ADMIN_PASSWORD`. The Dashboard should show 140 orders.
3. Open **Vendors** and **Purchase Orders**, and reload one of them to check the SPA fallback.

### Notes

- **Free Render services sleep when idle.** The first request after a pause can take up to a minute while the API wakes; if a page shows a network error, wait a moment and reload. Free Render databases also expire after a limited time, so check Render's current free-tier terms before a demo.
- **Changing `JWT_SECRET` logs everyone out.**
- **Database URLs:** the Render web service should use the **Internal** URL; your machine uses the **External** URL with `?sslmode=require`.
