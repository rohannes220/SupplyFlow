# SupplyFlow Agent Instructions

## Project Context
- Full-stack supply chain app (CS6983 P2): React 18, Vite, Tailwind 3, Node 20, Express 4, PostgreSQL 16, and JWT.
- Workspace paths: `frontend/`, `backend/`, `shared/`, and `docs/`. The project uses pnpm workspaces.
- Backend layering is `routes` -> `controllers` -> `services` -> `models/db` (match existing order code).
- Frontend API calls live in `frontend/src/services/`.
- Playwright tests go in `e2e/`.
- Standards: ES modules, Prettier, ESLint, camelCase functions, PascalCase components, and snake_case tables.
- Do not hard-code secrets. Use parameterized SQL and bcrypt. Document every endpoint in Swagger.
- Testing: TDD; commit failing tests first. Use Vitest, Supertest, and Playwright; target 80% service coverage. Run `pnpm lint` and `pnpm test` before committing.

## Requirements and Design
- The official requirements are transcribed in `docs/PRD.md` from `docs/Project_Req_Documents.pdf` (US-01–US-10). Never invent features.
- Mockups are in `docs/supplyflow-mockups.png`; use an enterprise dashboard with sidebar navigation, summary cards, searchable tables, and modal forms.
- `MetricCard` refreshes on data changes; `OrderForm` calculates totals; `StatusBadge` shows order status; hide restricted controls by role.
- Flow: Login → Dashboard. Employee creates Draft → Pending; admin approves → Shipped → Delivered. Reject invalid transitions (400) and unauthorized actions (403).

## Decisions
- **Vendors:** Fields: `id`, `name`, `email`, `phone`, `city`, `state`, `status` (`Active`/`Inactive`). Deactivate, never delete. States use two-letter US codes; phones contain 10 digits only. Reuse `shared/usLocations.js`.
- **Orders:** Fields: `id`, `vendor_id`, `created_by`, `status`, `expected_delivery_date`, `total_amount`, `created_at`, `ship_to_city`, `ship_to_state` (US only). Calculate `total_amount` on the server from `order_items`.
- **Status:** Draft → Pending (creator) → Approved (admin) → Shipped → Delivered (admin). Cancel from Draft (creator) or Pending (creator/admin). Delivered and Cancelled are final.
- **Routes:** `PUT /api/vendors/:id`, `PUT /api/orders/:id`, `PATCH /api/orders/:id/status`.
- **Ownership:** Patrick: auth/roles, vendors, dashboard, deployment, README. Rohan: orders, items, status workflow, CI, diagrams.
## Git Workflow
- Branches: `feature/<issue#>-description`, e.g. `feature/8-order-approval`.
- Commits: `type(scope): summary (#issue)`, e.g. `feat(orders): add approval (#8)`.
- PRs include `Closes #<issue>`, pass CI, get partner review, and flag AI-generated code. Move the board card to In Review when opened.
- Reference issues in code as `// TODO(#12): ...`.
