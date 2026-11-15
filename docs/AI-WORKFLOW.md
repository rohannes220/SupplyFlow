# How We Built SupplyFlow with AI

This document records how we (Rohan Kumar and Patrick Tarumbwa) used AI coding tools to build
SupplyFlow: what worked, where the AI went wrong, and how we caught it. Commit hashes refer to
this repository's history (`git show <hash>`).

## 1. Tools

- **The course names Antigravity as the primary AI IDE, but we did not use it as our main
  tool.** Most of the AI-assisted work was done with **Claude Code**, Anthropic's coding agent,
  running in **VS Code**.
- **GitHub Copilot** also appears in the history. It is listed as co-author on 13 of Rohan's
  commits, and the Copilot coding agent (`copilot-swe-agent[bot]`) resolved two merges from
  `master` into feature branches.
- **`AGENTS.md`** at the repository root is the shared rules file. Claude Code and Copilot both
  read this kind of file, so one document gave both tools the same stack, layering, naming,
  security and git rules.
- **Disclosure in PRs:** pull requests say when code was AI-assisted, as `AGENTS.md` requires.
  Examples are #26 – #31 and #37 – #41. Nine commits are authored by Claude, and nine
  more carry a `Co-Authored-By: Claude` line.

## 2. Context engineering

An agent is only as good as the context it starts with. We kept the AI on track with four
layers of context.

1. **`AGENTS.md`: standing rules.** It covers the stack, the backend layering
   (`routes → controllers → services → models`), naming, "parameterized SQL and bcrypt", "never
   invent features", TDD, and the branch and commit format. Every session starts from it, so we
   didn't repeat these in every prompt.
2. **`docs/PRD.md`: the source of truth for scope.** Prompts named the user story (for example,
   "Dashboard (US-10)"). The agent could then check acceptance criteria instead of guessing, and
   the "never invent features" rule had something concrete to point at.
3. **The Decisions section: settled questions.** Decisions such as the status workflow, the
   vendor fields, "deactivate, never delete" and the exact routes went into `AGENTS.md` once. The
   agent stopped re-asking or re-deciding them in each session. When a decision changed (fixed
   administrators, order ownership, the active-vendor check), we updated the section.
4. **Focused prompts: one issue, explicit limits.** Each prompt covered one GitHub issue, said
   which files were in scope, and listed what must not change.

### Prompt patterns that worked

| Pattern                             | Example (paraphrased from our sessions)                                                                    | Why it helps                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Tests first, then stop**          | "Implement issue #14. Step 1 only: write FAILING tests, then stop. Show me the test files."                | We review _what_ will be built before any implementation exists. The red commit is real                                   |
| **Implement step 2**                | "Step 2: implement with these decisions: … Run lint and all tests and show results."                       | The agent implements against tests we already agreed on, and the decisions are explicit                                   |
| **Fence the scope**                 | "Fix the TEST only … Don't change app code." / "Don't modify order components or tests." / "Don't commit." | Stops the agent from "fixing" a failure by changing the wrong thing, or touching a partner's code                         |
| **Verify against the code**         | "Verify EVERY command, script name, env var, path and URL against the actual code before writing it."      | Documentation written from memory drifts. This forced the agent to read `package.json`, `.env.example` and the migrations |
| **Protect secrets while debugging** | "Diagnose without printing any secrets." / "Print only true/false. Delete the script afterwards."          | We could debug configuration without leaking `.env` values into the transcript                                            |
| **Show the evidence**               | "Run lint and all tests and show results."                                                                 | We judged real output (pass/fail counts, exit codes), not the agent's summary                                             |

## 3. AI-assisted TDD

The red/green pattern is visible in the history. A `test(...)` commit adds failing tests, and
the matching `feat(...)` or `fix(...)` commit makes them pass:

| Feature                                         | Red (failing tests)                                                                             | Green (implementation)                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Login, `/me`, role middleware (US-01/02, #2 #3) | `3f3d65d` test(auth): add failing tests for login, /me, and role guards                         | `47698c0` feat(auth): add JWT login, /me, and role middleware             |
| Order security and status workflow (#2 #3 #5)   | `7f0cd0d` test(orders): add failing tests for order auth, status transitions and role rules     | `5392d91` fix(orders): require login, enforce status workflow and roles … |
| Dashboard (US-10, #10)                          | `ae14049` test(dashboard): add failing tests for dashboard metrics API, model, page and routing | `8d8ec63` feat(dashboard): add dashboard metrics API and page …           |
| Swagger / OpenAPI docs (#14)                    | `4cace91` test(docs): add failing tests for OpenAPI spec and Swagger UI                         | `eac40d5` feat(docs): serve OpenAPI spec and Swagger UI at /api/docs      |

The same pattern appears in the vendor work (`93d954f` → `e9935b3`, `b9500e1` → `17c00ee`). It
also appears in Rohan's order and administrator work: `3a2dc3f` → `e03fb7a` (role and ownership
access), `757490a` → `04af5d8` (fixed administrators) and `3f07ec8` → `5cc350f` (active vendor).

How a step usually went:

1. **Red.** The agent wrote tests from the user story and the existing code, then ran them. We
   checked that they failed _for the right reason_. "Route returns 404 because it doesn't exist
   yet" is a valid failure; "import error in the test file" is not.
2. **Review the tests.** We read them before allowing any implementation, and adjusted the scope
   where needed. For Swagger, for example, we asked for a redirect from `/api/docs` to
   `/api/docs/` to be allowed.
3. **Green.** The agent implemented, then ran lint and the whole suite, not just the new tests.
4. **Commit separately.** The two commits went in separately, so the PR shows red then green.

## 4. Human review: what we checked and what we caught

For every AI change we:

- read the diff
- ran `pnpm lint` and `pnpm test` ourselves, and later relied on CI
- checked that the change stayed inside the requested scope
- checked the behaviour in the running app for UI work

Some issues were caught by us, some by CI, and some by the AI's own checks once we asked for
them. These are real cases from the history.

### Migration order and test setup

Two feature branches each added a migration numbered `003`: `003_create_vendors.sql` (vendors)
and `003_order_owner.sql` (order ownership). `migrate.js` applies files in filename order, so the
pair happened to run in a workable order, but by luck rather than by design. Migration `004`
(fixed administrators) also only succeeds after both admin accounts exist. That ordering
requirement had to be written down explicitly; it is now in the README and
`docs/DEPLOYMENT.md`.

The numbering bit us in tests. `rbac.db.test.js` lists the migrations it needs by hand and didn't
include the vendors table. Once the active-vendor check landed, creating an order in that test
returned **500** in CI. We told the agent to fix the **test only, not app code**. The fix
(`c3e7846`) adds the vendors migration, an Active vendor and a vendor model, mirroring
`orderVendor.db.test.js`. The agent also noticed that an in-memory vendor model alone would not
have been enough, because the order SQL itself queries the `vendors` table.

### Broken `seed.js` after a merge

Resolving a merge conflict (`d5bd5b0`, `master` into the fixed-administrators branch) dropped the
vendor seeding step and left a reference to an undefined `ordersInserted`. Lint failed on
`master`. We asked for a fix that changed nothing else. It restores users → vendors → orders and
fixes the 4 lint errors (PR #37).

_Lesson:_ the fix landed in commit `8c9ea1a`, whose message mentions only the Vercel ignore
rule. Read the commit message against the diff before committing.

### The `vercel.json` placeholder

When we prepared deployment (`15d12eb`), the agent didn't know the Render URL yet, so it left
`https://RENDER_URL_PLACEHOLDER/api/$1` in `frontend/vercel.json` and noted it in the deployment
steps. Until it was replaced, the frontend could not reach the API: every `/api` call would go
to a host that doesn't exist. `5cfed62` points the rewrite at the real Render URL. It also adds `.vercelignore`, so local `.env` files can never be
uploaded to Vercel.

_Lesson:_ placeholders need a checklist item, not just a mention in chat. The deployment guide
now has a troubleshooting entry for this.

### "Login doesn't work" (in-memory mode)

Logins that had worked suddenly failed locally. The cause was configuration, not the code: the
API had been started without loading `backend/.env`. With no `DATABASE_URL`, it fell back to
in-memory mode, which has no user accounts. We had the agent diagnose this **without printing
any secrets**, using a throwaway script that printed only true/false for "is DATABASE_URL set" and
similar checks. The fix (`6172532`) makes `pnpm dev:api` load `.env`. The API's startup log already
said `Using in-memory data`, but we hadn't read it. The README and the deployment guide's
troubleshooting section now explain the symptom.

### Smaller catches

- **Invalid OpenAPI YAML.** Making the spec builder strict (`failOnErrors`) exposed an unquoted
  colon in an `@openapi` comment in `authRoutes.js`. That would have silently dropped the
  `bearerAuth` scheme from the docs. It also exposed a duplicated documentation block for
  `PATCH /api/orders/{id}/status`. That file is Rohan's, so the agent asked before removing the
  block, and the change was called out for review.
- **`pnpm audit` in CI.** The agent found that a blocking full audit would fail on every run,
  because of critical advisories in **dev-only** tools (Vitest 2, Vite 5). We chose to block on
  production dependencies and report the rest, rather than ship a permanently red pipeline. We
  documented the upgrade that would make the full audit blocking.
- **The AI's own test mistakes.** Running the suites caught several bugs in AI-written tests: a
  spy shared between tests, a race in a role test, a missing `await`, and E2E customer names
  containing digits, which the app's own validation rejects. In each case we fixed the test, not
  the app.

## 5. Limits and lessons

- **The agent can't know what isn't in the repo.** Deployment URLs, which accounts should be
  administrators, and who owns what had to come from us. When it lacked a fact, the right
  behaviour was a placeholder plus a flag, and the human's job was to close the loop.
- **"Tests pass" is not "it works".** Unit tests passed while local login failed (configuration)
  and while the live site pointed at a placeholder (deployment). We kept checking the running
  app and the deployed site, not just CI.
- **Scope fences matter most on shared code.** Our "don't modify X" prompts prevented the agent
  from changing a partner's order code to make its own feature pass. When a change to the other
  partner's code was justified, such as the duplicated docs block, the agent asked first and the
  change was called out for review.
- **Merges are where things break.** The worst regressions (the seed script, the test
  migrations) came from combining parallel branches, not from single AI changes. CI on `master`
  caught them.
- **Docs drift fastest.** The README and `AGENTS.md` fell out of date as features changed. The
  fix was the "verify every command and path against the code" prompt, plus updating
  `AGENTS.md` whenever a decision changed.
- **We stayed responsible for the code.** Everything merged was reviewed by a human partner, and
  PR descriptions say what was AI-assisted. Where the AI and the PRD disagreed with reality,
  such as order line items not being built yet, we documented the gap instead of hiding it.
