# SupplyFlow AGENTS.md

## Project Context
Full-stack supply chain app (CS6983 P2). Stack: React 18, Vite, Tailwind 3, Node 20, Express 4, PostgreSQL 16, JWT.
Structure: `client/` (pages, components, `src/api/`), `server/` (routes → controllers → services → db), `e2e/`, `docs/`.
Standards: ES modules, Prettier, ESLint. camelCase functions, PascalCase components, snake_case tables. No hard-coded secrets; use parameterized SQL and bcrypt. Document every endpoint in Swagger.
Testing: TDD; commit failing tests first. Vitest (unit), Supertest (integration), Playwright (E2E). Target 80% coverage on services. Run `pnpm lint` and `pnpm test` before committing.

## PRD & Design
Requirements: `docs/Project_Req_Documents.pdf` (US-01–US-10). Never invent features.
Mockups (`docs/mockups/`): enterprise dashboard with fixed sidebar, summary cards, searchable tables, modal forms.
Components: `MetricCard` refreshes on data changes; `OrderForm` auto-calculates totals; `StatusBadge` shows order status; restricted controls hidden by role.
Flow: Login → Dashboard. Employee creates Draft order → submits (Pending) → Admin approves → Shipped → Delivered. Server rejects invalid transitions (400) and unauthorized actions (403).

## Workflow
Branches: `feature/<issue#>-description`, e.g. `feature/8-order-approval`.
Commits: `type(scope): summary (#issue)`, e.g. `feat(orders): add approval (#8)`.
PRs: include `Closes #<issue>`, pass CI, get one partner review, and flag AI-generated code. Move the board card to In Review when opened.
Reference issues in code as `// TODO(#12): ...`.
