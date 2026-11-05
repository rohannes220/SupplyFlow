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
