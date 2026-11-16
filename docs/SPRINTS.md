# SupplyFlow Sprints

Rohan Kumar and Patrick Tarumbwa ran two sprints for SupplyFlow. This document covers the sprint
plan, the standups, the retrospectives and our feedback for each other.

**How this was built.** Everything here comes from one of these sources:

- The git history (`git log --all --date=short`) and the merged pull request titles
- The GitHub milestones and issues
- The sprint plan in [`docs/PRD.md`](PRD.md) and the [Partner Log](Partner-Log.md)
- Meeting notes that Patrick wrote down afterwards

Every standup row names its source. We did not make up meetings, quotes or plans. Where there is
no evidence, the row is a **TODO** for that partner to fill in from memory.

Dates are local commit dates. GitHub shows some PRs and issues one day later because it uses
UTC.

## 1. Overview

| Sprint   | Planned (PRD)   | GitHub milestone due | When the work happened   | Issues                        |
| -------- | --------------- | -------------------- | ------------------------ | ----------------------------- |
| Sprint 1 | 24 – 31 October | 7 November           | 24 October – 10 November | 7 (issues #1 – #6 and PR #25) |
| Sprint 2 | 1 – 12 November | 12 November          | 8 – 14 November          | 10 (#7 – #16)                 |

How the dates line up:

- The two sprints overlapped. Most Sprint 1 issues were not finished until **8–10 November**,
  the same days as the first Sprint 2 work.
- In this document, standups up to 7 November (the Sprint 1 milestone date) belong to Sprint 1.
  Standups from 8 November on belong to Sprint 2.
- The Sprint 1 milestone holds 7 items: issues #1 – #6 and the registration PR #25. Issue #20
  ("US-01/US-02: Authentication and roles", opened and closed by Patrick on 9 November) has no
  milestone.

**Milestones.** Sprint 1 has 7 issues and Sprint 2 has 10. All are closed.

**Estimation.** Each issue has a size label:

| Label | Meaning            |
| ----- | ------------------ |
| S     | Half a day or less |
| M     | About one day      |
| L     | Two days or more   |

**These estimates were not made during planning.** Patrick added all 16 `estimate:` labels on
the evening of 14 November (15 November UTC on GitHub), during the Sprint 2 retrospective. They
record how big the work turned out to be, not a forecast made in advance.

## 2. Sprint 1

**Goal (PRD).** Set up React, Express and PostgreSQL. Add JWT authentication and the Admin and
Employee roles. Build vendor management and purchase order creation. Write the first unit and
integration tests.

**Planning.** We wrote PRD v1.1 together and planned Sprint 1 from its sprint plan on 24
October. Rohan created the Sprint 1 milestone and issues #1 – #6 on 26 October.

### Issues

The assignee comes from GitHub. "Who did the work" comes from commits and PRs.

| #     | Issue                                   | Size | Assignee | Who did the work                                                                                                                 |
| ----- | --------------------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Configure React, Express and PostgreSQL | M    | Rohan    | Rohan set up the structure (`c26e059`). Database integration was joint (Partner Log)                                             |
| 2     | Implement JWT authentication            | L    | Rohan    | Patrick built login, `/me` and JWT (PRs #21, #22). Rohan built registration (PR #25)                                             |
| 3     | Implement Admin and Employee roles      | M    | Rohan    | Patrick added the role middleware (`47698c0`). Rohan added role and ownership checks and the fixed administrators (PRs #33, #34) |
| 4     | Build vendor management                 | L    | Patrick  | Patrick built the vendor API and UI (PRs #28, #29). Rohan added vendor data (PR #24)                                             |
| 5     | Implement purchase order creation       | L    | Rohan    | Rohan, with AI-authored commits on 5 November. Also PRs #23 and #32                                                              |
| 6     | Create unit and integration tests       | M    | Rohan    | Both of us. Each feature had a failing-test commit first                                                                         |
| PR 25 | Registration (in the milestone as a PR) | –    | –        | Rohan (`ee9b745` → `66a34b5`)                                                                                                    |

### Standups

**Sources:**

- **meeting:** a meeting, as Patrick wrote it down afterwards
- **async, from commits/PRs:** what the git history and GitHub show for that day

In the "Next" column, "Not recorded" means we found no evidence of what was planned.

| Date   | Partner | Done                                                                                                                                                                                                                                        | Next                                                                                                   | Blockers                                                                                               | Source                                               |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 24 Oct | Both    | Wrote PRD v1.1                                                                                                                                                                                                                              | Work on Sprint 1 as the PRD plans it: setup, authentication and roles, vendors, purchase orders, tests | None recorded                                                                                          | meeting                                              |
| 26 Oct | Rohan   | Set up the project structure (`c26e059`). Added the PRD and mockups (`f2b4480`). Created the Sprint 1 milestone and issues #1 – #6                                                                                                          | Not recorded                                                                                           | None recorded                                                                                          | async, from commits/PRs                              |
| 28 Oct | Patrick | Concluded planning and the structure of the tech stack                                                                                                                                                                                      | Begin implementing the sprint work                                                                     | None                                                                                                   | meeting (Zoom call)                                  |
| 30 Oct | Patrick | Added the first `AGENTS.md` (`d471bb8`). Created the Sprint 2 milestone and issues #7 – #16                                                                                                                                                 | Not recorded                                                                                           | None recorded                                                                                          | async, from commits/PRs                              |
| 5 Nov  | Rohan   | Built the orders CRUD API with US-only validation, support for US territories and the Add Order form, each with a failing-test commit first (`47a4d65` … `4586362`). Added sample vendor and order data (`ca1dc77`). Opened PRs #17 and #18 | Not recorded                                                                                           | PRs #17 and #18 were closed without merging, but their commits reached `master` through later branches | async, from commits/PRs (commits authored by Claude) |

## 3. Sprint 2

**Goal (PRD).** Finish purchase order management. Add approval and order tracking. Build the
analytics dashboard. Add end-to-end tests. Set up CI/CD and security scanning. Deploy the app.
Finish the documentation and the demo video.

**Planning.** Patrick created the Sprint 2 milestone and issues #7 – #16 from the PRD on 30
October. We met three times while the sprint ran:

- **8 November:** we split the features. Rohan took orders and Patrick took vendors. We then
  wrote down our shared decisions in `AGENTS.md` (PR #19, merged by Rohan).
- **9 November:** we split that day's work.
- **10 November:** we reviewed progress, agreed the two fixed administrator emails and split the
  remaining work.

### Issues

None of the Sprint 2 issues is assigned on GitHub. "Who did the work" comes from commits and PRs.

| #   | Issue                                                    | Size | Who did the work                                                                                                                        |
| --- | -------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Complete purchase order editing and cancellation         | M    | Both. Rohan added status updates and checked deletion (`8e6e955`). Patrick enforced the status workflow (`5392d91`). No commit cites #7 |
| 8   | Implement order submission and approval workflow         | L    | Both. Patrick added the status transitions and role rules (`5392d91`). Rohan added approval tests (`6a6c739`). No commit cites #8       |
| 9   | Implement order status tracking                          | M    | Rohan (PR #35)                                                                                                                          |
| 10  | Build analytics dashboard                                | M    | Patrick (PR #30)                                                                                                                        |
| 11  | Add end-to-end tests with Playwright                     | M    | Patrick (PR #40, still open)                                                                                                            |
| 12  | Configure CI/CD pipeline and security scanning           | L    | Patrick. PR #27 added the basic CI. PR #41, the full pipeline, is still open                                                            |
| 13  | Deploy application to Vercel and Render                  | M    | Patrick (PRs #31, #36)                                                                                                                  |
| 14  | Add Swagger/OpenAPI API documentation                    | S    | Patrick (PR #38)                                                                                                                        |
| 15  | Write README, deployment guide and architecture diagrams | M    | Patrick wrote the README and deployment guide (PR #39). Rohan made the diagrams (`9830d0d`)                                             |
| 16  | Record demo video and complete sprint retrospectives     | M    | Both. This document is part of it                                                                                                       |

Issues #11, #12, #14 and #16 were closed on 12 November, at the milestone deadline. Some of their
work landed later: Swagger was merged on 14 November, and PRs #40 and #41 were still open when
this document was written.

### Standups

| Date      | Partner | Done                                                                                                                                                                                                                                                                                                                          | Next                                                                                                                   | Blockers                                                                                                                                                                                                          | Source                     |
| --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 8 Nov     | Both    | Split the features: Rohan took orders, Patrick took vendors. Agreed our decisions and recorded them in `AGENTS.md` (PR #19)                                                                                                                                                                                                   | Build the features each of us took                                                                                     | None recorded                                                                                                                                                                                                     | meeting                    |
| 8 Nov     | Patrick | Aligned `AGENTS.md` and the PRD (`55eb2e9`). Built JWT login, `/me` and the role middleware, failing tests first (`3f3d65d` → `47698c0`)                                                                                                                                                                                      | Not recorded                                                                                                           | None recorded                                                                                                                                                                                                     | async, from commits/PRs    |
| 9 Nov     | Both    | Split the day's work                                                                                                                                                                                                                                                                                                          | Rohan: display data, order tracking, login authentication. Patrick: display data, vendor tracking, analytics dashboard | None recorded                                                                                                                                                                                                     | meeting                    |
| 9 Nov     | Rohan   | Updated the vendor and order data (`8b35a13`). Added the demo orders seed and an offline fallback for development (`923b56d`). Added status updates, checked deletion and price sorting (`8e6e955`). Built registration, failing tests first (`ee9b745` → `66a34b5`). Merged PRs #23 – #25                                    | Not recorded                                                                                                           | Registration and login needed PostgreSQL in development. Fixed in `97e6284`                                                                                                                                       | async, from commits/PRs    |
| 9 Nov     | Patrick | Built the login UI (`89aca74` → `10f649e`), the vendor API (`93d954f` → `e9935b3`) and UI (`b9500e1` → `17c00ee`), and the dashboard (`ae14049` → `8d8ec63`), each failing tests first. Secured orders (`7f0cd0d` → `5392d91`). Added CI (`7ba8920`) and the deployment config (`15d12eb`). Opened PRs #21, #22 and #26 – #31 | Not recorded                                                                                                           | Login behaved differently with and without a database in development. The dev script now loads `.env` (`6172532`)                                                                                                 | async, from commits/PRs    |
| 10 Nov    | Both    | Reviewed what each of us had done. Agreed the two fixed administrator emails                                                                                                                                                                                                                                                  | Split the remaining work                                                                                               | None recorded                                                                                                                                                                                                     | meeting                    |
| 10 Nov    | Rohan   | Added role and ownership access (`3a2dc3f` → `e03fb7a`), the active-vendor check (`3f07ec8` → `5cc350f`), the fixed administrators (`757490a` → `04af5d8`) and the status filter (`6a6c739` → `fa9552e`), each failing tests first. Merged PRs #32 – #35                                                                      | Not recorded                                                                                                           | None recorded                                                                                                                                                                                                     | async, from commits/PRs    |
| 10 Nov    | Patrick | Merged PRs #21, #22 and #26 – #31. Pointed the Vercel API rewrite at Render (`5cfed62`). Fixed the `seed.js` lint errors (`8c9ea1a`) and the `rbac.db` test (`c3e7846`). Merged PRs #36 and #37                                                                                                                               | Not recorded                                                                                                           | CI failed after the branches were merged. `seed.js` lint errors came in with merge `d5bd5b0`, and the `rbac.db` test broke after the active-vendor check was added. `vercel.json` still had a placeholder API URL | async, from commits/PRs    |
| 10–14 Nov | Both    | Messaged about PR reviews and repository settings. Split the documentation: Rohan took the architecture and database diagrams and the Partner Log; Patrick took the README, Swagger and the deployment guide; we share the retrospectives and the video; each of us writes a reflection                                       | The demo video                                                                                                         | None recorded                                                                                                                                                                                                     | messages (Patrick's notes) |
| 12 Nov    | Rohan   | Added the architecture and database diagrams (`9830d0d`) and the Partner Log (`efe152e`, `1c1c837`)                                                                                                                                                                                                                           | Not recorded                                                                                                           | None recorded                                                                                                                                                                                                     | async, from commits/PRs    |
| 14 Nov    | Patrick | Added Swagger, failing tests first (`4cace91` → `eac40d5`, PR #38). Wrote the README and deployment guide (PR #39). Added the Playwright end-to-end tests (`953ee40` → `1561281`, PR #40). Built the multi-stage CI/CD pipeline (`231ab85`, PR #41). Updated `AGENTS.md` and wrote the AI workflow document (PR #42)          | Merge PRs #40 – #42. Record the demo video                                                                             | None recorded                                                                                                                                                                                                     | async, from commits/PRs    |

## 4. Retrospectives

### Sprint 1

**What went well**

- We had a written PRD, mockups and a set of sized issues before we wrote any feature code.
- `AGENTS.md` existed from 30 October, so AI agents had project rules from the start.
- Rohan wrote failing tests before the code from the very first orders feature (`47a4d65` →
  `740e818`, 5 November).

**What was hard**

- Little feature code was written before the planned end date of 31 October. Most Sprint 1
  issues were closed on 10 – 12 November.
- PRs #17 and #18 were closed instead of merged, so the history of the first orders work is
  harder to follow.

**What we'd do differently**

- Write the first feature code in the first days of the sprint, not after the PRD and setup are
  done.
- Size issues during planning, not afterwards.

### Sprint 2

**What went well**

- **How we split the work** (Patrick). The 8 – 10 November meetings gave each of us a clear
  area.
- **Building the features** (Patrick), especially the dashboard and vendor management. Both
  shipped with API and UI tests.
- **Failing tests first.** Almost every feature has a red commit followed by a green one. For
  example:
  - authentication: `3f3d65d` → `47698c0`
  - order security: `7f0cd0d` → `5392d91`
  - dashboard: `ae14049` → `8d8ec63`
  - Swagger: `4cace91` → `eac40d5`
  - fixed administrators: `757490a` → `04af5d8`
- **CI caught real bugs** soon after it was added on 10 November:
  - `seed.js` lint errors that came in with merge `d5bd5b0`
  - an `rbac.db` test that broke after the active-vendor check was added

  We fixed both before the end of the day (PR #37, `c3e7846`).

**What was hard**

- **Deployment** (Patrick: the most frustrating part).
  - `vercel.json` was first committed with a placeholder API URL (`15d12eb`). It had to be
    pointed at Render later (`5cfed62`).
  - `render.yaml` had to be changed again for Neon (`0f48920`).
  - Running with and without a database caused confusion about which login would work locally
    (`97e6284`, `6172532`).
- **Lots of merging at once.** Seventeen PRs were merged on 9 – 10 November, and
  branches merged in parallel broke each other (merges `d5bd5b0` and `17482d4`).
- **Process gaps.**
  - No Sprint 2 issue was assigned on GitHub.
  - No PR has a formal GitHub review; we reviewed by message instead.
  - Several issues were closed on the deadline before their work was merged.

**What we'd do differently**

- **Learn GitHub workflows properly** (Patrick): branch protection, required reviews, keeping
  branches up to date with `master`, and the project board. That would make us faster and
  cleaner.
- **Deploy early.** Ship a "hello world" to Vercel and Render in Sprint 1 so that deployment
  problems surface early.
- **Keep CI green.** Merge only when CI passes, and update a branch with `master` before merging
  it.

### Overall

**What went well**

- A clear split between orders (Rohan) and vendors, the dashboard and deployment (Patrick).
- One shared `AGENTS.md`, which kept both partners and their AI tools consistent.
- Failing tests first, and CI checking every change.

**What was hard**

- Deployment.
- A slow start, followed by an intense final week (8 – 14 November) in which almost all the code
  was written.

**What we'd do differently**

- Spread the work evenly over both sprints.
- Estimate during planning.
- Use GitHub reviews and branch protection.
- Learn the GitHub workflow before the project starts, not during it.

## 5. Partner feedback

### Patrick on Rohan

In Patrick's words:

> "Efficient, organised and a capable programmer; to improve: communication style and
> apportioning of work."

### Rohan on Patrick

In Rohan's words (source: Rohan's sprint notes (Nov 2026)):

- **Sprint 1:** "Patrick did a good job implementing vendor functionality."
- **Sprint 2:** "Patrick contributed to automated testing and deployment."
