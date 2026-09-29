# NexaERP — System Architecture

| | |
|---|---|
| **Status** | Phase 0 — Architecture (baseline) |
| **Version** | 1.0 |
| **Date** | 2026-09-28 |
| **Applies to** | Every later phase of NexaERP |
| **Contains code?** | No. This document defines what *will* be built. |

NexaERP is a professional portfolio-grade, multi-tenant ERP/HRMS. This document is the single
source of truth for the architecture of the whole system. Changes here must be deliberate,
documented, and must never contradict `PROJECT_RULES.md`.

## Table of contents

1. [Overall system architecture](#1-overall-system-architecture)
2. [Next.js frontend architecture](#2-nextjs-frontend-architecture)
3. [NestJS backend architecture](#3-nestjs-backend-architecture)
4. [PostgreSQL + Prisma architecture](#4-postgresql--prisma-architecture)
5. [Supabase Auth and Storage integration](#5-supabase-auth-and-storage-integration)
6. [Multi-tenant architecture](#6-multi-tenant-architecture)
7. [RBAC architecture](#7-rbac-architecture)
8. [API architecture](#8-api-architecture)
9. [Frontend/backend folder structure](#9-frontendbackend-folder-structure)
10. [Database module boundaries](#10-database-module-boundaries)
11. [Security architecture](#11-security-architecture)
12. [Testing architecture](#12-testing-architecture)
13. [Docker/development architecture](#13-dockerdevelopment-architecture)
14. [Vercel deployment architecture](#14-vercel-deployment-architecture)
15. [Free-tier-first infrastructure](#15-free-tier-first-infrastructure)
16. [Key architectural decisions (ADR summary)](#16-key-architectural-decisions-adr-summary)
17. [Environment variable registry](#17-environment-variable-registry)
18. [Phase roadmap — what will be built later](#18-phase-roadmap--what-will-be-built-later)
19. [Consistency and PROJECT_RULES compliance](#19-consistency-and-project_rules-compliance)

---

## 1. Overall system architecture

### 1.1 Architecture style

**Modular monolith deployed as two independent applications** (as required by `PROJECT_RULES.md`):

- **`apps/web`** — Next.js (React, TypeScript, Tailwind CSS) UI, deployed on Vercel.
- **`apps/api`** — NestJS (TypeScript) modular monolith, deployed as a Docker container.
- **`packages/shared`** — one package of zod/TypeScript contracts used by both apps.
- **PostgreSQL + Supabase Auth + Supabase Storage** — one Supabase project per environment.

Business domains (identity, organization, and later employees, attendance, leave, payroll,
recruitment) live **inside** the single NestJS process as isolated modules — never as separate
services. This keeps transactions simple, deployment free and the code reviewable, while module
boundaries preserve a clean extraction path if the system ever needs to split.

```
                    ┌──────────────────────────────────────────────────────────┐
                    │                        Browser                          │
                    └──────────────┬─────────────────────────┬─────────────────┘
                                   │ HTTPS: UI + JSON API    │ HTTPS: direct sign-in
                                   │ calls                   │ and token refresh
                                   ▼                         ▼
┌──────────────────────────────────────────────────┐  ┌─────────────────────────────┐
│ VERCEL (Hobby)                                  │  │ SUPABASE (Free project)     │
│ apps/web — Next.js App Router                   │  │ • Auth (GoTrue): JWT issue  │
│ • UI + advisory permission hints                │  │ • Storage: private buckets  │
│ • Supabase session cookies (@supabase/ssr)      │  │ • Postgres (production DB)  │
│ • never authorizes on its own                   │  └──────────────┬──────────────┘
└──────────────┬───────────────────────────────────┘                 │
               │ HTTPS                                               │
               │ Authorization: Bearer <supabase access JWT>         │
               │ X-Tenant-Id: <tenant uuid>                          │
               ▼                                                     │
┌──────────────────────────────────────────────────┐                 │
│ RENDER FREE (Docker container)                   │                 │
│ apps/api — NestJS modular monolith               │                 │
│ Guard pipeline: AuthGuard → TenantGuard          │                 │
│                 → PermissionsGuard               │                 │
│ Modules: identity, organization, storage …       │                 │
│ + later: employees, attendance, leave, payroll,  │                 │
│   recruitment, reports                           │                 │
│ Prisma ─ tenant-scoped query extension ─┐        │                 │
└──────────────┬──────────────────────────┼────────┘                 │
               │ verify JWT locally       │ SQL as nexaerp_app       │ service-role key
               │ (SUPABASE_JWT_SECRET,    ▼                          │ (server only)
               │  no network call)  ┌────────────────────────────────┴────────┐
               └───────────────────►│ POSTGRES (Supabase Free / Docker local) │
                                    │ • shared-schema multi-tenancy           │
                                    │ • RLS = defense-in-depth                │
                                    │ • least-privilege roles                 │
                                    └─────────────────────────────────────────┘
```

### 1.2 Runtime components

| Component | Technology | Host | Responsibility |
|---|---|---|---|
| Web app | Next.js (App Router), React, TypeScript, Tailwind | Vercel Hobby | UI, session handling, data display. **Never** trusted for authorization. |
| API | NestJS, TypeScript, Prisma | Render Free (Docker) | Auth verification, tenancy, RBAC, business logic, audit, OpenAPI. |
| Database | PostgreSQL 16 | Supabase Free (dev/prod), Docker (local/CI) | System of record. |
| Identity | Supabase Auth | Supabase | Sign-in, refresh tokens, MFA, JWT issuance. |
| Files | Supabase Storage | Supabase | Private buckets; access only via API-issued signed URLs. |
| CI | GitHub Actions | github.com | Lint, typecheck, tests, build, contract drift check. |
| Shared contracts | `packages/shared` (zod) | monorepo | Single source of truth for request/response shapes, permission codes, enums. |

### 1.3 Canonical request flow

```
1.  Browser signs in directly against Supabase Auth → access JWT (~1h) + refresh token.
    @supabase/ssr stores the session in cookies (web only; the API never sees refresh tokens).
2.  Browser calls the API:   GET /api/v1/employees
        Authorization: Bearer <access JWT>
        X-Tenant-Id: <uuid of the active tenant>
3.  AuthGuard        → verifies HS256 signature/exp locally with SUPABASE_JWT_SECRET,
                       resolves (and lazily provisions) the application user.
4.  TenantGuard      → verifies the caller's membership for X-Tenant-Id; rejects otherwise,
                       then stores tenant context for the request.
5.  PermissionsGuard → requires the route's permission codes (deny by default).
6.  Prisma extension → injects/validates tenantId on every tenant-scoped query.
7.  Postgres RLS     → independently rejects rows outside current_setting('app.tenant_id')
                       (defense-in-depth; correctness does not depend on it — see §6.3).
8.  Response: { "data": … } on success, application/problem+json on failure (§8.4).
```

### 1.4 Non-functional requirements and scale envelope

Free-tier-first means designing to a realistic envelope instead of pretending to be hyperscale.

| Dimension | Target (v1) | Design consequence |
|---|---|---|
| Tenants | ≤ 100 | Shared-schema tenancy; no per-tenant infrastructure. |
| Users | ≤ 5,000 total, ≤ 50 concurrent | Supabase Free (50k MAU) is ample. |
| API compute | 1 instance, 512 MB / 0.1 vCPU (Render Free) | Small Prisma pool, no in-memory cache assumptions, no Redis. |
| Database | ≤ 500 MB (Supabase Free) | Index discipline, soft deletes, no event-bloat tables. |
| Latency | p95 < 500 ms warm | Indexed queries only; N+1 forbidden; cold starts accepted (§15). |
| Availability | Best effort, no SLA on free tier | Health endpoints + uptime monitor used as keep-alive (§14.4). |
| Accessibility | WCAG 2.1 AA | Radix-based primitives, full keyboard access, visible focus. |
| TypeScript | `strict: true` + `noUncheckedIndexedAccess`; no `any` in exported APIs | Enforced by `tsc` in CI. |
| Data integrity | UTC `timestamptz`, UUID PKs, `numeric` for money (never floats) | §4.3. |

---

## 2. Next.js frontend architecture

> Built in Phase 1 (skeleton) and Phase 3 (shell/design system). Nothing in this section exists
> yet.

### 2.1 Core decisions

- **Next.js App Router** with TypeScript and Tailwind CSS (stack from `PROJECT_RULES.md`).
- **Split rendering strategy:**
  - Public/marketing/auth pages → Server Components (SEO, fast first paint).
  - The authenticated ERP app → **client-side data fetching** against the NestJS API via React
    Query. ERP data is auth-gated, per-tenant and dynamic; SSR of it adds token plumbing and
    complexity with no SEO benefit (ADR-015).
- **No global state library.** Server state lives in React Query; UI state is local
  (`useState`/context). Redux/Zustand explicitly rejected (ADR-009).
- **The frontend never authorizes.** It hides/disables what the user may not do, using the
  permission list from `/api/v1/auth/me`, purely for UX. Every request is still verified by the
  API; UI permission data is untrusted, display-only data.

### 2.2 Session and API access

- `@supabase/ssr` keeps the session in cookies; `middleware.ts` refreshes tokens and redirects
  unauthenticated visitors to sign-in.
- Two typed clients in `lib/api/`:
  - `browserClient` — attaches `Authorization` (from session) + `X-Tenant-Id` (active tenant,
    localStorage) on every request.
  - `serverClient` — only for Server Components/Route Handlers fetching **non-tenant** data
    (public pages). Keeping tenant data out of server rendering is what makes §1.3 simple.
- Problem-details errors map to typed client errors: 401 → refresh/sign-out, 403 → "no access"
  state, 409/422 → field-level form errors.

### 2.3 Routing structure

Route groups keep auth logic and the authenticated shell separate:

- `(public)/` — landing pages (Server Components).
- `(auth)/` — sign-in, sign-up, password reset (Supabase-driven).
- `(app)/` — authenticated shell: sidebar, top bar, tenant switcher, user menu. Its `layout.tsx`
  requires a valid session **and** an active tenant before rendering.
- Feature routes (e.g. `(app)/employees/...`) are added **only in their own phase** — no empty
  placeholder routes are ever shipped (rule: no fake/placeholder functionality).

### 2.4 UI layer

- `components/ui/` — in-repo primitives (button, dialog, dropdown, table, form fields) built on
  **Radix UI** for accessibility, styled with Tailwind. No component kit with its own theme
  runtime: keeps the look professional and the dependency list small.
- `features/<feature>/` — feature-scoped components, React Query hooks, local zod form schemas
  (imported from `packages/shared` whenever they mirror an API contract).
- Forms: `react-hook-form` + `zodResolver` (justified: ERP forms are numerous and non-trivial).
- Tables: `@tanstack/react-table` (sort, filter, column visibility, pagination) — ERP is
  table-heavy; hand-rolling it is more code and more bugs.
- Icons: `lucide-react`. Anything outside the approved dependency list (§11.7) needs a written
  reason in the PR.

### 2.5 Frontend quality gates

`next lint`, `tsc --noEmit`, unit/component tests (Vitest + Testing Library) and a production
`next build` all run in CI before merge (§12, §14).

---

## 3. NestJS backend architecture

> Built in Phase 1 (skeleton + health) and Phase 2 (auth/tenancy/RBAC).

### 3.1 Application shape

- **NestJS modular monolith**, one deployable process, global prefix `/api` with URI versioning
  → every route is `/api/v1/...`.
- Global pipeline in `main.ts`:
  - `helmet` security headers; CORS allowlist (`WEB_ORIGIN`, credentials off — Bearer auth).
  - `ZodValidationPipe` (global) validates requests against zod schemas from `packages/shared`.
    `class-validator` is not used (ADR-006).
  - Global exception filter → RFC 9457 `application/problem+json` (§8.4).
  - Request-ID interceptor (accept/generate `x-request-id`) + structured pino logging with
    redaction of `authorization`, cookies and personal data.
  - `@nestjs/throttler` global rate limiting (§8.7).
- **OpenAPI** is generated from the same zod contracts and served at `/api/v1/docs`; CI fails if
  the committed `docs/openapi.json` drifts from the code (§8.8).

### 3.2 Layering inside the API

```
Controller  — HTTP only: parse request → call service → serialize response
    ↓
Service     — business rules, transactions, permission-semantic checks, audit writes
    ↓
Repository  — the only place a module touches Prisma (its own tables only)
    ↓
TenantDb    — scoped Prisma client from core/prisma (§6.3)
```

Rules:

- Controllers contain no business logic and no Prisma.
- Services never receive the raw Prisma client — only `TenantDb`.
- Cross-cutting concerns are injected from `core/`; feature modules never re-implement auth,
  tenancy, RBAC, audit or error handling.

### 3.3 Core modules (cross-cutting, no business features)

| Core module | Provides |
|---|---|
| `core/config` | Zod-validated env loading; the app refuses to boot on missing/invalid env. |
| `core/prisma` | `PrismaModule`, `TenantDb` (scoped client + transaction wrapper that sets the tenant GUC), migration runner. |
| `core/auth` | `AuthGuard` (verifies Supabase JWT), `@Public()`, `@CurrentUser()`, lazy user provisioning. |
| `core/tenancy` | `TenantGuard`, `X-Tenant-Id` resolution, AsyncLocalStorage tenant context, `@CurrentTenant()`. |
| `core/rbac` | `PermissionsGuard`, `@RequirePermissions(...)`, permission catalog sync. |
| `core/audit` | `AuditService` (append-only writes), `@Audit()` for sensitive operations. |
| `core/logging` | pino logger, request correlation, redaction. |
| `core/errors` | `ProblemDetailsException` + stable codes (`AUTH_REQUIRED`, `TENANT_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_FAILED`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`, `INTERNAL`). |
| `core/health` | `/api/v1/health/live`, `/api/v1/health/ready`. |

### 3.4 Guard pipeline (one explicit order)

```
@UseGuards(AuthGuard, TenantGuard, PermissionsGuard)
```

1. **AuthGuard** — global by default; opt out per route with `@Public()`. Verifies the Supabase
   access JWT and resolves the application user.
2. **TenantGuard** — requires `X-Tenant-Id` on tenant-scoped routes, verifies membership,
   populates tenant context. Genuinely global routes (e.g. listing the caller's tenants) are
   marked explicitly and handled inside the guard — never by disabling it globally.
3. **PermissionsGuard** — **deny by default**: a route with neither `@Public()` nor
   `@RequirePermissions(...)` fails closed at runtime. A forgotten guard becomes a bug report,
   not a security hole.

### 3.5 Feature modules

- **Phase 2:** `modules/auth` (`/auth/me`), `modules/identity` (users, memberships, roles
  administration), `modules/organization` (tenant profile/settings), `modules/storage` (upload,
  signed URLs).
- **Later phases:** `employees`, `attendance`, `leave`, `payroll`, `recruitment`, `reports` —
  each in its own phase, each owning its tables (§10).

Module rules:

- Each module exposes a public surface (`index.ts` with injected service tokens). Other modules
  use those services — never another module's repositories or Prisma models.
- No circular module imports; `AppModule` wires the graph.
- **Background work:** none needed in v1. When Payroll later requires heavy/async jobs, a
  BullMQ + Upstash Redis (free tier) worker is introduced **in that phase** — no unused queue
  abstraction ships before then. Light scheduled tasks, if ever needed, use `@nestjs/schedule`
  in-process.

---

## 4. PostgreSQL + Prisma architecture

> Schema work begins in Phase 2 (core tenancy/RBAC tables). This section defines conventions
> every later phase must follow.

### 4.1 Ownership and tooling

- Prisma lives with the API: `apps/api/prisma/schema.prisma` + `apps/api/prisma/migrations/`.
- **Single `schema.prisma` file** organized into commented domain sections (one per module).
  Multi-file schema folders are a preview feature — rejected; this project uses **no preview
  flags** so the toolchain stays stable.
- Migrations are **append-only and additive-first** (expand → backfill → contract in a later
  release). Never edit an applied migration; never `prisma db push` for shared environments.
- `prisma migrate deploy` runs automatically at API startup (`AUTO_MIGRATE=true` — safe because
  v1 is a single API instance, §1.4) using the migrator connection (§4.6). If the API is ever
  scaled to multiple replicas, `AUTO_MIGRATE` is turned off and migrations move to a one-shot
  job; that switch is recorded as an ADR at the time.

### 4.2 Naming and mapping conventions

- Models PascalCase; tables/columns mapped to `snake_case` with `@@map`/`@map`.
- Primary keys: `id uuid @default(dbgenerated("gen_random_uuid()")) @id` (generated in the DB).
- Every table: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL`
  (Prisma `@updatedAt`). Business tables also carry nullable `created_by uuid`,
  `updated_by uuid` and `deleted_at timestamptz` (soft delete).
- Enums: Prisma enums → Postgres enums, `snake_case` names.
- Mandatory indexes: every FK, every `(tenant_id, …)` access pattern, every list sort/filter
  column. Tenant tables always lead with `tenant_id`
  (e.g. `@@index([tenantId, deletedAt, createdAt])`).
- Deletes: `onDelete: Restrict` by default; `Cascade` only where the lifecycle genuinely
  requires it, documented in the migration. The application soft-deletes business records;
  financial records are never deleted through the app.

### 4.3 Type conventions

| Concern | Rule |
|---|---|
| Money | `numeric(19,4)` + separate `currency char(3)`; Prisma `Decimal`. **Floats are forbidden for money** — this is a payroll system. |
| Dates | `timestamptz` only (UTC). Date-only concepts (attendance day) use `date` plus an explicit tenant timezone. |
| Text | `text` with application-level max length enforced by zod. |
| JSON | `jsonb` only for non-queryable metadata (`metadata jsonb`), never as a substitute for columns that must be filtered or joined. |
| Booleans | `boolean NOT NULL DEFAULT false`. |
| Soft delete | All business queries include `deleted_at IS NULL`, implemented once in the repository layer. |

### 4.4 Database roles (least privilege)

| Role | Used by | Rights |
|---|---|---|
| `nexaerp_migrator` (table owner) | `prisma migrate` only, via `DIRECT_URL` | DDL, owns schema, bypasses RLS as owner. Never used at runtime. |
| `nexaerp_app` | Prisma runtime via `DATABASE_URL` | `SELECT/INSERT/UPDATE/DELETE` on business tables; `INSERT/SELECT` only on `audit_logs` (no `UPDATE`/`DELETE`); **no `BYPASSRLS`**. |
| Supabase `service_role` key | `apps/api` → Supabase Storage only | Server-side secret; never shipped to any client. |

The application **never** connects as `postgres`/owner, so RLS applies to every runtime query.

### 4.5 Connection management

- v1 runs one long-lived API container → Prisma uses a **direct (session) connection** with a
  small pool (~5–10, sized for 512 MB). Supabase's transaction pooler (`:6543`) is deliberately
  **not** used: session state (`SET LOCAL app.tenant_id`, §6.3) and prepared statements behave
  predictably only on a direct connection.
- If the API later moves serverless, the pooler is adopted together with a redesign of the
  tenant-GUC wrapper — recorded as an ADR at that time.
- `SELECT 1` backs `/api/v1/health/ready`.

### 4.6 Environment split

| Variable | Contains | Used by |
|---|---|---|
| `DATABASE_URL` | `nexaerp_app` credentials (runtime pool) | Prisma Client at runtime |
| `DIRECT_URL` | `nexaerp_migrator` credentials, direct connection | Prisma Migrate (schema `directUrl`) |

Two URLs, one schema: DDL stays out of the runtime role while developers still run a single
command (`pnpm db:migrate`).

### 4.7 Seeding

- **Permission catalog sync** at API startup: the code-defined catalog (§7.2) is upserted into
  the `permissions` table. Idempotent and required for RBAC — real functionality, not scaffolding.
- **Demo/fixture data** (`pnpm seed:demo`) is a separate, explicit script for local dev and E2E
  only. It never runs in production.

---

## 5. Supabase Auth and Storage integration

> Implemented in Phase 2 (Auth) and Phases 3–4 (Storage consumers).

### 5.1 Project layout (free tier = 2 active projects)

| Supabase project | Purpose |
|---|---|
| `nexaerp-dev` | Local development, E2E tests, preview demos. |
| `nexaerp-prod` | Production. |

Accepted free-tier caveats (documented, not hidden): projects **pause after ~7 days of
inactivity** (the keep-alive ping in §14.4 makes the API run `SELECT 1` against this database
every few minutes, which counts as activity; manual unpause is the fallback),
**no automatic backups** (→ scheduled `pg_dump`, §15.3), 1-day log retention, 50 MB max upload
(app caps itself at 10 MB).

### 5.2 Authentication flow

- Sign-in is handled **entirely by Supabase Auth** from the browser (email/password first;
  Supabase free includes basic TOTP MFA, so MFA is a supported design point surfaced in a later
  phase). The API contains no password logic.
- `@supabase/ssr` stores the session in cookies; access token TTL ~1 hour, rotated by refresh.
- **API verification:** `AuthGuard` verifies the access token **locally** (HS256 with
  `SUPABASE_JWT_SECRET`): signature, `exp`, `iss`. No network call per request.
- **Claims policy (important):** Supabase's `role` claim (`authenticated`) is *not* an
  application role and is **never used for authorization**. No custom JWT claims are injected
  either — that would make revocation impossible within the token lifetime. Authorization comes
  only from the database (§7).
- **Lazy user provisioning:** on first authenticated API request, `ensureUser(jwt)` upserts the
  application `users` row (`auth_user_id` = JWT `sub`, email/name from claims). Chosen over auth
  webhooks: no extra endpoint or infrastructure on the free tier, and it cannot drift out of sync
  with sign-in.
- **Sign-out:** the client calls Supabase `signOut` (refresh token revoked server-side). Access
  tokens are stateless and cannot be revoked individually; the ≤1 h TTL bounds exposure — an
  accepted, documented trade-off.

### 5.3 Application user mapping

- `users.auth_user_id uuid UNIQUE` ↔ Supabase `auth.users.id`.
- **No foreign key** into `auth.users` (cross-schema coupling to a managed schema is rejected).
- One application user may hold memberships in several tenants (§6).

### 5.4 Storage integration

- **All file access goes through the API.** Browsers never talk to Supabase Storage directly —
  one authorization point instead of two (ADR-010).
- Two **private** buckets: `nexaerp-media` (avatars/images) and `nexaerp-documents`.
- Object key convention: `{tenantId}/{yyyy}/{uuid}-{sanitized-filename}` — tenant isolation is
  structural and visible in every key.
- **Upload:** `POST /api/v1/storage/objects` (multipart) → authN/authZ → validation (MIME
  allowlist, 10 MB app limit, filename sanitization) → stored via `@supabase/storage-js` with the
  **service-role key** (server-only secret).
- **Download:** `GET /api/v1/storage/objects/:id/url` → authN/authZ → returns a signed URL with
  60-second TTL; the browser fetches directly from Supabase (download egress counted once).
- Per-feature file *metadata* tables belong to the feature module that owns them (e.g. an
  employee document row references an object key). The storage module owns no business tables.

---

## 6. Multi-tenant architecture

> Core tables and guards land in Phase 2. Every later module is tenant-scoped by construction.

### 6.1 Model

- A **Tenant** is one organization using NexaERP — the unit of data isolation and settings.
- A **User** is a global identity (one Supabase account). Access to a tenant is granted by a
  **TenantMembership** row. Users may belong to several tenants (multi-tenant by membership, not
  by login).
- Each membership carries **roles** (§7); the tenant creator becomes its `Owner`.
- Tenant identity: `id uuid` (internal, used in `X-Tenant-Id`) + `slug` (URLs/display), unique
  and immutable after creation.

### 6.2 Strategy: shared schema (ADR-004)

One database, one set of tables, `tenant_id uuid NOT NULL` on every tenant-scoped table.
Rejected: database-per-tenant (untenable on one 500 MB free database, migration nightmare) and
schema-per-tenant (same problems, less tooling). Because isolation cannot be assumed, it is
**enforced in three independent layers**.

### 6.3 Layered isolation

| Layer | Mechanism | Protects against |
|---|---|---|
| **1. Request** | `TenantGuard` verifies `X-Tenant-Id` → membership row in DB. A client cannot assert membership. | Forged/foreign tenant IDs, missing context. |
| **2. Query** | Prisma **tenant extension** — the only client handed to modules (`TenantDb`): injects `where.tenantId` on every tenant-scoped model, injects `tenantId` on `create`, **throws** on unscoped access to a scoped model, and rejects attempts to filter a different `tenantId`. Raw SQL must go through the wrapper that sets the tenant GUC. | Forgotten filters, mass assignment, accidental cross-tenant reads. |
| **3. Database** | Row-Level Security on tenant tables using `current_setting('app.tenant_id')`, applied to the non-privileged `nexaerp_app` role (§4.4). The GUC is set with `SET LOCAL` inside the transaction wrapper from `core/prisma`. | A defect in layers 1–2 (defense-in-depth). |

**Honest scope:** layers 1 and 2 are mandatory and are what correctness depends on. Layer 3 is
defense-in-depth, implemented and *proven* by integration tests in Phase 2 — including a test
that a direct SQL query as `nexaerp_app` cannot read another tenant's rows. If, during Phase 2
verification, RLS + Prisma integration proves unreliable, the fallback is recorded as an ADR
(layers 1–2 plus `NOT NULL`/composite constraints). The architecture never *relies* on RLS, so
this cannot become a hidden contradiction later.

### 6.4 Tenant context propagation

- `TenantGuard` stores `{ userId, tenantId, membershipId }` in **AsyncLocalStorage** for the
  request; services and the Prisma wrapper read it from there. No threading `req` through every
  call, no ambient global state.
- Cross-tenant/platform operations are needed by no v1 module. If platform tooling ever exists,
  it uses a separate guard and separate routes (`/api/v1/platform/*`) with explicit audit —
  never a bypass flag inside tenant code.

### 6.5 Tenant lifecycle

`created (sign-up) → active → suspended (admin) → (soft) deleted`. `TenantGuard` serves only
`active` tenants. Data export/GDPR teardown is deliberately a future phase, not improvised.

---

## 7. RBAC architecture

> Built in Phase 2, extended by every later module. Server-side only, deny-by-default.

### 7.1 Model

```
users ─< tenant_memberships >─ tenants
              │
              ├─< membership_roles >─ roles ─< role_permissions >─ permissions
              │                          (tenant-scoped)    (global catalog)
```

- **Permissions** are a *global, code-defined catalog* (strings like `employee.read`). Code is
  the source of truth; the `permissions` table mirrors it at startup (§4.7) so roles can be
  stored relationally.
- **Roles** are tenant-scoped bundles of permissions (e.g. "HR Manager"). Tenants create custom
  roles; system roles (`Owner`) are protected from edit/delete.
- **Grants** are `membership → role → permissions`. No implicit grants, no wildcard logic in
  code (`Owner` is materialized as an explicit grant of every permission at tenant creation),
  no inheritance hierarchy — flat roles have fewer bugs.

### 7.2 Permission catalog

Defined once in `packages/shared/permissions.ts` as a const array → type-safe union usable on
both sides. Naming: `<resource>.<action>` (lowercase dot notation).

- **Phase 2 core:** `tenant.read`, `tenant.update`, `user.invite`, `user.suspend`, `role.read`,
  `role.create`, `role.update`, `role.delete`, `audit.read`, `storage.upload`, `storage.delete`.
- **Later phases extend it in their own phase**, e.g. `employee.read/create/update/delete`,
  `attendance.manage`, `leave.approve`, `payroll.run`, `payroll.read`, `recruitment.manage`,
  `report.view` — listed here only to fix the naming convention, not built now.

### 7.3 Enforcement

- `@RequirePermissions('payroll.run')` on every non-public controller route, checked by
  `PermissionsGuard` after authentication and tenant resolution. Multiple codes = caller needs
  **all** of them (any-of semantics would be spelled explicitly with separate decorators if ever
  required).
- **Fail closed:** a route with neither `@Public()` nor `@RequirePermissions(...)` is rejected at
  runtime and flagged in logs — an unguarded route is a bug, not a default-open endpoint.
- Lookup: membership → roles → permissions, resolved from the DB **per request** (indexed joins,
  no cache). Correctness beats micro-optimization at this scale; if profiling later shows
  pressure, a short-TTL cache with invalidation on role mutation is the recorded next step.
- Platform-admin bypass does not exist in v1 (§6.4).

### 7.4 Frontend usage (advisory only)

`GET /api/v1/auth/me` returns `{ user, tenants, activeTenant, permissions }`. The UI hides or
disables actions accordingly. **Presentation only** — the same request sent without the
permission still receives `403` from `PermissionsGuard`. This satisfies "never trust frontend
authorization" while keeping the UI honest.

### 7.5 Auditability

Every privileged mutation (role/membership/permission changes, and later payroll runs, deletions)
goes through `AuditService`: actor, tenant, action, entity, entity id, metadata, IP, timestamp →
append-only `audit_logs` that the app role cannot `UPDATE` or `DELETE` (§4.4).

---

## 8. API architecture

### 8.1 Style

**REST over JSON, versioned under `/api/v1`** (ADR-007). GraphQL rejected: ERP operations are
resource-shaped CRUD plus a few actions; REST is cacheable, trivially auditable, and produces a
clean OpenAPI document with far fewer dependencies.

### 8.2 URL conventions

```
GET    /api/v1/employees            list (paginated, filterable, sortable)
GET    /api/v1/employees/:id        fetch one
POST   /api/v1/employees            create
PATCH  /api/v1/employees/:id        partial update
DELETE /api/v1/employees/:id        soft delete
POST   /api/v1/employees/:id/…      domain actions (approve, suspend, run) — verbs only for actions
GET    /api/v1/auth/me              caller context + permissions
GET    /api/v1/health/ready         readiness
```

- Nouns in paths, HTTP verbs for CRUD, action sub-resources for domain operations.
- The paths above are **illustrative conventions** — concrete endpoints arrive only with their
  own phase (§18); `/employees` resources exist from Phase 4, not before.
- Breaking changes require `/api/v2`; additive (backward-compatible) changes stay in v1.
- The tenant is **never** in the path — it travels in `X-Tenant-Id` (one header, verified once).

### 8.3 Request headers

| Header | Required | Meaning |
|---|---|---|
| `Authorization: Bearer <jwt>` | all non-public routes | Supabase access token |
| `X-Tenant-Id: <uuid>` | all tenant-scoped routes | active tenant, verified against membership |
| `x-request-id` | optional | correlation; generated when absent |

### 8.4 Response envelope and errors

- Success: `{ "data": <resource | resource[]> }`; lists add
  `meta: { page, pageSize, total }`. **Always** wrapped — no ad-hoc shapes.
- Errors: RFC 9457 `application/problem+json`:

```json
{
  "type": "https://nexaerp.dev/problems/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "Request payload failed validation.",
  "code": "VALIDATION_FAILED",
  "instance": "/api/v1/employees",
  "errors": [{ "path": "email", "message": "Invalid email" }]
}
```

- Stable machine-readable `code` values come from `core/errors` (§3.3); responses never leak
  framework or database internals. Status mapping: 400 malformed request (unparseable JSON,
  bad header syntax), 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict,
  413 payload too large, **422 schema/business validation** (matches the example above and
  §12.3), 429 rate-limited, 500 internal (generic), 503 dependency unavailable (database or
  other backing service down — `SERVICE_UNAVAILABLE`).

### 8.5 Pagination, filtering, sorting

- `?page=1&pageSize=25` (max 100) with `meta.total` — ERP tables need page numbers and totals
  (ADR-014). Cursor pagination is explicitly deferred until an endpoint needs unbounded streams.
- Filters are a per-endpoint whitelist (`?status=active&q=jane`) — never raw client SQL.
- Sort is a per-endpoint whitelist (`?sort=createdAt:desc`); unknown fields → 400.

### 8.6 Validation and typing

- zod schemas in `packages/shared` define every request/response body. The same schema validates
  at the API edge (`ZodValidationPipe`), types the frontend, and generates OpenAPI — one
  contract, three consumers, zero drift (ADR-006).
- Domain rules (invariants spanning rows) live in services, not in zod.

### 8.7 Rate limiting and abuse control

- Global: e.g. 300 requests/min per identity (user id, else client IP) via `@nestjs/throttler`.
- Stricter bucket for auth-sensitive endpoints (e.g. 10/min).
- 429 returns `Retry-After` plus `RATE_LIMITED` problem details.
- In-process counters are correct because v1 is a single instance; the documented switch point
  for multi-instance is a shared store (Upstash/Redis) — not needed now (ADR-012).

### 8.8 OpenAPI contract

- Generated from zod via `@asteasolutions/zod-to-openapi`, committed as `docs/openapi.json`,
  browsable at `/api/v1/docs`.
- CI regenerates and diffs: contract drift fails the build, so the API document is a tested
  artifact rather than a stale file.

---

## 9. Frontend/backend folder structure

pnpm monorepo (ADR-008): one repo, one CI, shared contracts. No Turborepo — an unnecessary
dependency at this size.

```
nexaerp/
├── PROJECT_RULES.md
├── README.md
├── package.json                  # root scripts: dev, lint, typecheck, test, db:*, openapi:*
├── pnpm-workspace.yaml
├── tsconfig.base.json            # shared strict compiler options
├── eslint.config.js              # one flat, project-aware config
├── .prettierrc
├── .nvmrc                        # pinned Node LTS (same in Docker and CI)
├── .env.example                  # committed placeholders only — never real secrets
├── .gitignore                    # ignores .env* (except .env.example), node_modules, dist
├── docker-compose.yml            # postgres + api + web (local dev)
├── render.yaml                   # API service definition (infra as code)
│
├── apps/
│   ├── web/                                  # Next.js
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/                 # landing pages (RSC)
│   │   │   │   ├── (auth)/                   # sign-in, sign-up, reset
│   │   │   │   └── (app)/                    # authenticated shell (session + tenant guard)
│   │   │   ├── components/
│   │   │   │   ├── ui/                       # Radix-based primitives
│   │   │   │   └── layout/                   # sidebar, topbar, tenant switcher
│   │   │   ├── features/<feature>/           # feature hooks + components (added per phase)
│   │   │   ├── lib/
│   │   │   │   ├── api/                      # browserClient, serverClient, problem-details
│   │   │   │   ├── auth/                     # supabase ssr clients, session helpers
│   │   │   │   ├── tenancy/                  # active tenant store (localStorage)
│   │   │   │   └── utils/
│   │   │   ├── styles/
│   │   │   └── middleware.ts                 # session refresh + route protection
│   │   ├── tests/                            # Vitest unit/component tests
│   │   └── e2e/                              # Playwright specs
│   │
│   └── api/                                  # NestJS
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── core/                         # cross-cutting (§3.3): config, prisma, auth,
│       │   │   └── …                         # tenancy, rbac, audit, logging, errors, health
│       │   └── modules/                      # feature modules (§3.5) — added per phase
│       │       └── <feature>/
│       │           ├── <feature>.module.ts
│       │           ├── controllers/
│       │           ├── services/
│       │           ├── repositories/         # only place Prisma is touched per module
│       │           ├── dto/                  # thin re-exports of shared zod route schemas
│       │           └── *.spec.ts             # colocated unit tests
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts                       # permission catalog + explicit demo seed
│       ├── test/                             # integration tests + factories
│       ├── Dockerfile                        # multi-stage, non-root
│       └── package.json
│
├── packages/
│   └── shared/                               # contracts shared by web + api
│       └── src/
│           ├── contracts/                    # zod schemas per domain (request/response)
│           ├── permissions.ts                # permission catalog + types
│           ├── constants/                    # enums, limits, shared error codes
│           └── index.ts
│
├── docs/
│   ├── ARCHITECTURE.md                       # this file
│   └── openapi.json                          # generated, committed, CI-diffed
│
└── .github/
    ├── workflows/ci.yml                      # lint, typecheck, tests, build, openapi check
    └── dependabot.yml
```

Structural rules:

- Feature code never lives at `lib/` or `components/` root — it lives under `features/` so a
  domain is findable in one place on both sides.
- `core/` (api) and `lib/`+`components/ui` (web) contain only framework-level concerns, never
  business rules.
- Unit tests are colocated (`*.spec.ts`); integration and E2E live in `test/` and `e2e/`.
- No `.env` files are committed; `.env.example` documents every variable from §17.

---

## 10. Database module boundaries

### 10.1 Ownership map

Exactly one module owns each table; everyone else goes through that module's public service.

| Owner module | Tables | Phase |
|---|---|---|
| core/tenancy | `tenants` | 2 |
| core/identity | `users`, `tenant_memberships` | 2 |
| core/rbac | `roles`, `role_permissions`, `permissions`, `membership_roles` | 2 |
| core/audit | `audit_logs` | 2 |
| organization | `tenant_settings`, `org_units` (departments/locations) | 2 / 4 |
| storage | *(no business tables — object metadata belongs to consumers)* | 3 |
| employees | `employees`, `employment_records`, `employee_documents` | 4 |
| attendance | `attendance_policies`, `attendance_records` | 5 |
| leave | `leave_types`, `leave_requests`, `leave_balances` | 6 |
| payroll | `salary_structures`, `payroll_periods`, `payroll_runs`, `payslips` | 7 |
| recruitment | `job_postings`, `candidates`, `applications`, `interviews` | 8 |
| reports | *(read-only views owned by the producing modules, §10.3)* | 9 |

### 10.2 Rules

1. **One writer.** Only the owning module's repositories write its tables. Enforced by
   convention + code review now; an ESLint `no-restricted-imports` rule against foreign
   repository imports is added when the second feature module lands.
2. **Cross-module reads** go through the owning module's exported service — never ad hoc joins
   over another module's tables.
3. **Cross-module writes are forbidden.** If module A must change data owned by B, A calls B's
   service (same `TenantDb`, same transaction context).
4. **Cross-boundary foreign keys** are permitted only to core tables (`tenant_id`, `created_by`),
   always `Restrict`.
5. **No shared "utils" tables.** If two modules genuinely need the same concept, it is promoted
   to a core concept deliberately — never by accident.

### 10.3 Reporting exception (defined now, used in Phase 9)

The `reports` module may read other modules' data **only** through read-only SQL views (`v_*`)
created and owned by the producing module. This keeps reporting fast and the one-writer rule
intact. No report ever writes to a business table.

---

## 11. Security architecture

### 11.1 Principles

1. Never trust the client — frontend authorization is advisory (§7.4).
2. Deny by default — unauthenticated, unscoped and unpermitted all fail closed.
3. Least privilege — DB roles, secrets, API surface (§4.4).
4. Defense in depth — guard pipeline + query scoping + RLS + audit.
5. No secrets in the repo or the client bundle (§11.5).

### 11.2 Threat → control map

| Threat | Control |
|---|---|
| Stolen/forged token | Local HS256 verification with server-side secret, `exp` check, ≤1 h TTL, Supabase refresh rotation. |
| Horizontal escalation (tenant A reads tenant B) | Three-layer isolation (§6.3) + integration tests asserting cross-tenant reads return zero rows. |
| Vertical escalation (member runs payroll) | `PermissionsGuard`, fail-closed defaults, DB-stored roles revocable immediately. |
| IDOR / mass assignment | zod strips unknown fields; `tenantId`/`id` are never accepted from client bodies. |
| SQL injection | Prisma parameterization only; raw SQL is parameterized and restricted to the tenant wrapper. |
| XSS | React escaping, strict CSP, no `dangerouslySetInnerHTML`; session cookies are JS-readable by necessity of `@supabase/ssr` — accepted with CSP as the compensating control. |
| CSRF | The API authenticates with Bearer headers, not cookies → CSRF not applicable; state-changing routes reject form-encoded bodies. |
| Clickjacking / MIME sniffing | helmet: `X-Frame-Options`, `X-Content-Type-Options`, HSTS (platform TLS). |
| Brute force / abuse | Throttler buckets (§8.7) + Supabase auth protections (incl. MFA support). |
| Malicious file upload | Private buckets, MIME allowlist, size cap, sanitized keys, API-only upload (§5.4). |
| Audit tampering | Append-only `audit_logs` with no update/delete grant for the app role. |
| Dependency compromise | Dependabot + `npm audit` in CI + minimal dependency policy (§11.7). |
| Secret leak | Env-only secrets, `.env*` gitignored, redacted logs, platform secret stores. |

### 11.3 Headers, transport, CORS

- helmet defaults plus an explicit CSP for the web app (Next.js headers config):
  `default-src 'self'`, `connect-src` limited to API + Supabase origins, no arbitrary inline
  script beyond what Next requires.
- TLS everywhere (Vercel/Supabase/Render terminate TLS); HTTP→HTTPS forced.
- API CORS: explicit `WEB_ORIGIN` allowlist, limited methods/headers, `credentials: false`.

### 11.4 Authentication summary

Supabase Auth (managed) → short-lived HS256 JWT → verified locally by `AuthGuard` → user
resolved/created → tenant membership verified → permissions loaded. Password logic never exists
in this codebase; MFA is available through Supabase and surfaced in a later phase.

### 11.5 Secret inventory

| Secret | Stored in | Never in |
|---|---|---|
| `SUPABASE_JWT_SECRET` | Render env, local `.env`, CI (test value only) | repo, web bundle, logs |
| `SUPABASE_SERVICE_ROLE_KEY` | Render env only | repo, web bundle, CI logs |
| `DATABASE_URL` / `DIRECT_URL` | Render env, local `.env` | repo, web bundle |
| `NEXT_PUBLIC_*`, Supabase anon key | Vercel env / public by design | — (explicitly **not** secrets; documented to avoid confusion) |

Rules: no secret is ever hard-coded; `.env*` is gitignored (only `.env.example` with
placeholders is committed); logs redact `authorization`/cookies; secrets are rotated if history
ever leaks them.

### 11.6 Data protection

- PII minimized in logs (ids/emails only where needed; never tokens).
- Supabase encrypts data at rest; the free tier has **no backups** → scheduled `pg_dump` (§15.3)
  is a required deliverable of the deployment phase, together with a tested restore procedure.
- Deletes are soft; permanent erasure/GDPR export is a future phase, never improvised.

### 11.7 Dependency policy

Approved families (anything else needs a written reason in the PR): framework (next, react),
NestJS core packages, prisma, `@supabase/ssr` + `@supabase/storage-js`, tailwind, radix
primitives, `@tanstack/react-query` + `@tanstack/react-table`, `react-hook-form`, zod,
`lucide-react`, helmet, pino, throttler, swagger/zod-to-openapi; dev: vitest, jest,
`@nestjs/testing`, testing-library, playwright, eslint, prettier. Rejected by default: UI kits
with theme runtimes, state managers, axios (native `fetch`), date libraries (until a proven need).

---

## 12. Testing architecture

> "Every important feature must be tested." "Never claim something is complete without testing
> it." Tests are part of the definition of done for every phase.

### 12.1 Pyramid

| Layer | Runner | Scope | Location |
|---|---|---|---|
| Unit (api) | **Jest** (`@nestjs/testing`) | services, guards, permission logic, pure rules — repositories mocked | colocated `*.spec.ts` |
| Unit/component (web) | **Vitest** + Testing Library | hooks, permission-aware components, API-client error mapping | `apps/web/tests` + colocated |
| Integration (api) | **Jest** vs a **real Postgres** | Prisma tenant extension, RLS, full guard pipeline, audit writes, API contract parsing, tenant isolation | `apps/api/test` |
| Contract | zod + generated OpenAPI | shared schemas parse sample payloads; `openapi.json` diff check | CI |
| E2E | **Playwright** | critical journeys: sign-in → tenant switch → permission-gated action → role edit | `apps/web/e2e` |

Two runners is deliberate: Jest is the NestJS ecosystem default and Vitest is the natural
Next.js/ESM choice; forcing one onto the other stack means fighting the framework for no benefit.

### 12.2 Integration test environment

- **Real PostgreSQL only** — no SQLite, no mocked database. SQLite would not exercise `uuid`,
  `timestamptz`, `numeric`, `jsonb` or RLS behaviour.
- Local: `docker compose --profile test` Postgres + `prisma migrate deploy` into `nexaerp_test`.
  CI: GitHub Actions `postgres:16` service container, same migrations.
- Auth in API tests: tests mint their own HS256 tokens with a test-only
  `SUPABASE_JWT_SECRET` — CI needs no Supabase project and no network.

### 12.3 Mandatory test categories (regression armor)

1. **Tenant isolation:** a user/membership of tenant A can never read or write tenant B rows —
   proven through the API **and** via direct SQL as `nexaerp_app` (RLS proof).
2. **RBAC matrix:** allow/deny per permission-sensitive route; unguarded routes fail closed.
3. **Validation:** invalid payloads → 422 with field paths; unknown fields stripped.
4. **Audit:** privileged mutations append exactly one audit row; the app role cannot `UPDATE` it.
5. **Money math (Phase 7):** payroll calculations with decimal edge cases.

### 12.4 Quality gates

- Coverage: ≥ 75% lines globally; ≥ 90% for `core/auth`, `core/tenancy`, `core/rbac`,
  `core/prisma`.
- CI fails on: lint errors, type errors, failing tests, coverage below threshold, OpenAPI drift,
  failed `next build` / `nest build`.
- A phase is reported complete only after lint + typecheck + tests pass, with the actual results
  stated in the phase report.

### 12.5 Test data

Factory helpers (`apps/api/test/factories`) create isolated tenants/users/roles per test — no
shared mutable fixtures, no seed-order dependence, no parallel-test interference.

---

## 13. Docker/development architecture

### 13.1 Local topology

Two supported modes — **same migrations, same code**; only the database host changes:

| Mode | Database | Auth/Storage | Used for |
|---|---|---|---|
| **Default (offline-friendly)** | `postgres:16` container via `docker compose` | Supabase `nexaerp-dev` | Day-to-day development |
| **Hosted DB** | Supabase `nexaerp-dev` | Supabase `nexaerp-dev` | Reproducing Supabase-specific behaviour |
| **CI** | Ephemeral `postgres:16` service | none (test-minted JWTs) | Automated tests |

Authentication always comes from the hosted `nexaerp-dev` Supabase project — running GoTrue and
Storage locally would require the heavy Supabase CLI stack, which is rejected for simplicity.

### 13.2 `docker-compose.yml` (local dev)

| Service | Image/build | Ports | Notes |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | 5432 | named volume, healthcheck, `nexaerp` database |
| `api` | build `apps/api` (dev target, watch mode) | 4000 | waits for healthy postgres, source mounted |
| `web` | node dev container | 3000 | `pnpm dev --filter web` |

Profiles: default (all three), `test` (postgres only), `prod` (multi-stage production images —
also validates the real Dockerfiles locally).

### 13.3 Container standards (API)

- Multi-stage Dockerfile: `deps → build → runtime`; runtime is `node:*-alpine`, **non-root
  user**, `NODE_ENV=production`, ships only `dist/` + production dependencies;
  `HEALTHCHECK` → `/api/v1/health/ready`.
- Render runs this exact image (no buildpack magic); `docker compose --profile prod` runs the
  same artifact locally before it ships.
- The web app is **not** containerized for production (Vercel builds it, §14); its Dockerfile
  exists only for dev parity.

### 13.4 Developer workflow

```bash
git clone … && cp .env.example .env    # fill local values; never commit
pnpm install
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed        # migrate + permission catalog sync
pnpm dev                               # web:3000 + api:4000, hot reload
pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
pnpm test:e2e                          # needs the full stack running
```

| Script | Meaning |
|---|---|
| `pnpm dev` | run web + api in watch mode |
| `pnpm lint` / `pnpm format` | ESLint (flat, typed) / Prettier |
| `pnpm typecheck` | `tsc --noEmit` across workspaces |
| `pnpm test` | unit tests (api + web) |
| `pnpm test:integration` | api tests against Postgres |
| `pnpm test:e2e` | Playwright |
| `pnpm db:migrate` / `db:reset` / `db:seed` | Prisma migrate / local reset / seed |
| `pnpm openapi:generate` / `pnpm openapi:check` | regenerate / CI drift check |

Node version pinned via `engines` + `.nvmrc` (LTS), identical in Docker and CI.

---

## 14. Vercel deployment architecture

### 14.1 Why the split is Vercel + Render

- **Web → Vercel**: first-class Next.js support, preview deployment per PR, free TLS/CDN.
- **API → Render (Docker)**: NestJS needs a long-running process (connection pooling, scheduled
  work, consistent in-process rate-limit state). Hosting the API as Vercel functions is explicitly
  rejected (ADR-002): per-request DB cold connections, execution limits, and a poor fit for a
  modular monolith.
- Both deploy **from the same repository** through Git integrations; no manual deploys.

### 14.2 Delivery pipeline

```
feature branch ──PR──► GitHub Actions CI: lint, typecheck, unit + integration tests,
│                      builds, OpenAPI drift check ── required by branch protection on `main`
│
├─ Vercel: preview deployment for the PR  (project root directory = apps/web)
│
main (all green) ──► Vercel: production deploy of `apps/web` (env vars from Vercel dashboard)
                  └─► Render: build image → `prisma migrate deploy` (AUTO_MIGRATE with
                              migrator creds) → start API (env vars from Render dashboard)
```

- Secrets live only in Vercel/Render/GitHub secret stores — never in the repo (§11.5).
- Migrations run **before** new code serves traffic, in the same deploy step, and must be
  backward compatible with the previous release (expand/contract discipline) so rollbacks stay
  safe.
- `render.yaml` commits the API service definition (infrastructure as code); the web project's
  config (root directory, env vars, domains) lives in Vercel's dashboard.

### 14.3 Environments

| Env | Web | API | Supabase |
|---|---|---|---|
| local | localhost:3000 | localhost:4000 | `nexaerp-dev` auth/storage; Docker or `nexaerp-dev` DB |
| preview | Vercel preview URL | shares the dev API (dedicated preview API only if later needed) | `nexaerp-dev` |
| production | custom domain (Vercel) | custom domain (Render) | `nexaerp-prod` |

Domains: `app.<domain>` (web) and `api.<domain>` (API); both platforms provide free TLS. The
API's CORS allowlist contains only the web origins of these environments.

### 14.4 Health, monitoring, keep-alive

- `/api/v1/health/live` (process up) and `/api/v1/health/ready` (DB reachable).
- A free uptime monitor (e.g. UptimeRobot, 5-minute interval) watches `/health/ready`. It is
  deliberately double-purpose: outage detection **and** prevention of Render Free's 15-minute
  spin-down (§15.2) — an explicit free-tier workaround, not a hidden assumption.
- Logs: pino JSON to stdout → platform log views (short retention on free tiers). Structured
  logs plus `x-request-id` allow web/API correlation without a paid APM.
- Optional error tracking (Sentry free tier) may be added in a later phase; nothing is wired
  today (no unused integrations).

---

## 15. Free-tier-first infrastructure

> Rules: "Prefer free/open-source services." "Keep the project deployable on free tiers where
> practical." Budget for v1: **$0/month** (optionally ~$10–15/year for a custom domain).

### 15.1 Stack and limits (verified 2026-09)

| Concern | Service (plan) | Free allowance | Known limitation accepted |
|---|---|---|---|
| Web hosting | **Vercel Hobby** | 100 GB transfer, 1M function invocations, PR previews | Non-commercial/personal use only → if NexaERP is ever monetized, move to Vercel Pro (trigger, §15.4) |
| API hosting | **Render Free web service** | 750 instance-hours/month, Docker deploys, custom domains | Spins down after ~15 min idle → ~30–60 s cold start, mitigated by the keep-alive ping (§14.4) |
| Database | **Supabase Free** | 500 MB, 2 active projects | Pauses after ~7 days inactivity; **no backups** → scheduled `pg_dump` required (§15.3) |
| Auth | **Supabase Auth Free** | 50k MAU, basic MFA | Shared email rate limits (custom SMTP e.g. Resend free tier if needed); 1-day auth log retention |
| File storage | **Supabase Storage Free** | 1 GB, 50 MB max upload | App caps uploads at 10 MB, below the platform cap |
| CI | **GitHub Actions** | unlimited minutes on a public repo; 2,000 min/month private | Playwright runs on `main`/nightly to protect the minute budget |
| TLS/domains | Vercel + Render + Supabase | automatic TLS | Custom domain is the only plausible paid cost |
| Monitoring | UptimeRobot free | 50 monitors, 5-min interval | Also serves keep-alive (§14.4) |
| Backups | `pg_dump` via scheduled GH Action | ≈ $0 storage | Manual restore discipline; no PITR |

**Rejected infrastructure, with reasons:** AWS full stack (operational complexity/cost for a
portfolio project), Fly.io (no free tier for new accounts in 2026), Railway (trial credit only),
Render's free Postgres (expires in 30 days — Supabase is the database), Supabase Edge Functions
for business logic (keeps logic out of the testable NestJS codebase), Redis/queues before a
module actually needs them (payroll phase).

### 15.2 Capacity plan

- One API instance, pool ≈ 5–10 connections → fits 512 MB comfortably.
- Growth drivers are soft-deleted rows and audit logs; a quarterly `pg_stat` review keeps the
  database under 500 MB before any paid tier is considered.
- Uploads: 10 MB cap against a 1 GB storage budget → a user-visible storage warning at 80%
  (later phase).

### 15.3 Data protection on the free tier

Supabase Free has no automatic backups, so the deployment phase must ship a scheduled `pg_dump`
(GitHub Actions, weekly, rotated artifacts) plus a documented, **tested** restore procedure. This
is a required deliverable, not a nice-to-have.

### 15.4 Upgrade triggers (documented decision points)

| Signal | Action | Approx. cost |
|---|---|---|
| Demo/latency pain from API cold starts | Render Starter (always-on) | ~$7/mo |
| Monetizing NexaERP | Vercel Hobby → Pro (commercial use requires it) | from $20/mo |
| DB approaching 400 MB, need backups/PITR, or project pauses hurt demos | Supabase Pro | $25/mo |
| Multiple API instances or serverless API | shared store for rate limits + pooler/tenant-GUC rework (ADRs) | as needed |
| Heavy payroll batch jobs | BullMQ + Upstash free tier, later paid | low |

Nothing above is built now; each is a decision point, not a commitment.

---

## 16. Key architectural decisions (ADR summary)

| # | Decision | Alternatives rejected | Why |
|---|---|---|---|
| ADR-001 | Modular monolith in one NestJS process | Microservices from day one | Required by project rules; free-tier friendly; real transactions; module seams keep a future split possible. |
| ADR-002 | Web and API as separate deployables | NestJS inside Next.js route handlers / BFF | Long-running process, pooling, independent scaling, one clear authz boundary; Vercel suits the web app only. |
| ADR-003 | Supabase Auth (managed) | Hand-rolled JWT/passwords, self-hosted IdP | Free, battle-tested refresh + MFA flow; removes the riskiest custom security code from the repo. |
| ADR-004 | Shared-schema multi-tenancy | DB-per-tenant, schema-per-tenant | One 500 MB free database; single migration path; isolation provided by layered enforcement (§6.3). |
| ADR-005 | App-layer scoping primary; RLS as defense-in-depth | RLS-only enforcement | Prisma + session-GUC friction makes RLS risky as the sole guarantee; correctness must not depend on it. |
| ADR-006 | zod as the single contract/validation layer | class-validator (API) + separate frontend validation | One source of truth → types, runtime validation and OpenAPI from one file; no drift. |
| ADR-007 | REST + versioned `/api/v1` + OpenAPI | GraphQL | Resource-shaped CRUD, simple caching and auditing, fewer dependencies, generated docs. |
| ADR-008 | pnpm monorepo with `packages/shared` | npm/yarn workspaces, multi-repo | Compile-time sharing of contracts across web/api, one CI, cheap installs. |
| ADR-009 | React Query for server state; no global store | Redux/Zustand | ERP is server-state heavy; less boilerplate; local state covers UI needs. |
| ADR-010 | Storage only through the API (private buckets + signed URLs) | Direct browser↔Supabase Storage | Single authorization point, simpler security review, tenant keys enforced server-side. |
| ADR-011 | RBAC in the DB, deny-by-default, no authz claims in the JWT | Supabase custom claims/roles | Immediate revocation, tenant-scoped roles, per-request auditability. |
| ADR-012 | In-process rate limiting; no Redis in v1 | Redis from day one | Correct for a single instance; avoids another service the free tier must host. |
| ADR-013 | Startup migrations via the owner `DIRECT_URL` | CI-only or platform pre-deploy hooks | Deterministic on any host and on free plans; gated by `AUTO_MIGRATE` for a future multi-replica setup. |
| ADR-014 | `page`/`pageSize` + `meta.total` | Cursor pagination | ERP tables need totals and page numbers; cursor deferred until an endpoint requires it. |
| ADR-015 | Client-side fetching inside the authenticated app; RSC for public pages | Full SSR of tenant data | Auth-gated data gains nothing from SSR; simpler token handling; snappier interaction. |

---

## 17. Environment variable registry

Single source of truth — a variable defined anywhere else is a documentation bug. `NEXT_PUBLIC_*`
is the only prefix allowed to reach the browser.

### `apps/web` (Vercel env + local `.env`)

| Variable | Secret? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | no | API base, e.g. `http://localhost:4000/api/v1` or `https://api.<domain>/api/v1` |
| `NEXT_PUBLIC_APP_URL` | no | Canonical web origin (links, redirects) |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Public anon key (safe by design; still env-managed) |

### `apps/api` (Render env + local `.env`)

| Variable | Secret? | Purpose |
|---|---|---|
| `NODE_ENV` | no | `development` / `production` |
| `PORT` | no | HTTP port (default 4000) |
| `WEB_ORIGIN` | no | CORS allowlist (comma-separated origins) |
| `DATABASE_URL` | **yes** | runtime pool as `nexaerp_app` (§4.6) |
| `DIRECT_URL` | **yes** | migrator connection for `prisma migrate` (§4.6) |
| `SUPABASE_URL` | no | Supabase project URL |
| `SUPABASE_JWT_SECRET` | **yes** | HS256 verification of access tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Storage operations only (§5.4) |
| `SUPABASE_STORAGE_BUCKET` | no | default private bucket |
| `AUTO_MIGRATE` | no | run `prisma migrate deploy` at boot (single instance only) |
| `LOG_LEVEL` | no | pino level |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | no | rate-limit defaults (documented fallbacks exist) |

CI-only: `TEST_DATABASE_URL` (ephemeral database), test-only `SUPABASE_JWT_SECRET` (minted
tokens, §12.2).

---

## 18. Phase roadmap — what will be built later

Phase 0 (**this document**) produced **no application code** and **no ERP features**. The phases
below are defined but **not started**: per `PROJECT_RULES.md`, no phase begins automatically —
each waits for an explicit instruction.

| Phase | Deliverables | Explicitly NOT in this phase |
|---|---|---|
| **0 — Architecture** ✅ (current) | `docs/ARCHITECTURE.md` only | any code |
| **1 — Foundation** | pnpm monorepo, strict TS/eslint/prettier, Next.js shell (public pages only), NestJS skeleton (config/logging/errors/health), Prisma init, Docker compose, `.env.example`, GitHub Actions CI, README | auth, tenancy, RBAC, business modules, protected UI |
| **2 — Auth, Tenancy & RBAC** | Supabase sign-in/out, the three guards, core tables (tenants, users, memberships, roles, permissions, audit), tenant provisioning, role/permission admin APIs, `/auth/me`, tenant switcher, isolation + RBAC test suites, OpenAPI generation | employees, attendance, leave, payroll, recruitment |
| **3 — App shell & design system** | `(app)` layout, permission-aware navigation, data-table and form primitives, accessibility pass, E2E harness (sign-in journey) | domain features |
| **4 — Organization & Employees** | org units, employee profiles/documents (first full feature module — proves §10 rules) | attendance, payroll |
| **5 — Attendance** | policies, clock records, reports | payroll |
| **6 — Leave** | leave types/requests/balances, approval flows | payroll |
| **7 — Payroll** | salary structures, periods, runs, payslips (decimal money math, audit, BullMQ only if justified) | recruitment |
| **8 — Recruitment** | job postings, candidates, applications, interviews | — |
| **9 — Reports & dashboards** | read-only views + reporting module, exports | — |
| **Ops (continuous)** | backup job + restore drill, monitoring, free-tier watch (§15.4) | — |

Every phase ends the same way: lint → typecheck → tests → fix → update docs → report exactly
what was completed and how it was verified.

---

## 19. Consistency and PROJECT_RULES compliance

### 19.1 Rules → architecture mapping

| `PROJECT_RULES.md` rule | Where satisfied |
|---|---|
| Build phase-by-phase | §18 roadmap; Phase 0 = docs only |
| Modular monolith | §1.1, ADR-001 |
| PostgreSQL + Prisma | §4 |
| Proper multi-tenancy | §6 (three layers + lifecycle) |
| Server-side RBAC | §7 (guards, DB roles, fail-closed) |
| Never trust frontend authorization | §2.1, §7.4, ADR-011 |
| Never hard-code secrets / never commit `.env` | §11.5, §17, `.gitignore` + `.env.example` (§9) |
| TypeScript strictly | §1.4 (`strict`, `noUncheckedIndexedAccess`) |
| Avoid unnecessary dependencies | §11.7 dependency policy + ADRs (no Redis, no state manager, no axios…) |
| No fake/placeholder functionality | §2.3 (no empty routes), §3.5 (no unused queue abstraction), §12 (tests required) |
| Every important feature tested | §12 (pyramid + mandatory categories + gates) |
| Professional, responsive, accessible UI | §1.4, §2.4 (WCAG 2.1 AA) |
| Prefer free/open-source; deployable on free tiers | §15 (verified limits, $0 budget, upgrade triggers) |
| Do not move to the next phase automatically | §18 explicit gate |
| Never claim complete without testing | §12.4 (completion = green lint/typecheck/tests) |
| Never rewrite working code unnecessarily | Phases are additive; §10 rules keep modules decoupled |

### 19.2 Self-consistency check (performed for v1.0)

Verified while writing this document — these pairs are consistent by design:

1. **Tenancy:** `X-Tenant-Id` header (§1.3, §8.3) ↔ no tenant in URLs (§8.2) ↔ Prisma extension
   auto-scoping (§6.3) ↔ RLS keyed on the same id (§4.4, §6.3) ↔ factories creating isolated
   tenants in tests (§12.5).
2. **RBAC:** code-first permission catalog (§7.2) ↔ synced to DB at startup (§4.7) ↔ enforced by
   `PermissionsGuard` (§7.3) ↔ advisory payload to the UI (§7.4) ↔ typed from
   `packages/shared` on both sides (§9).
3. **Contracts:** zod in the shared package (§8.6) ↔ `ZodValidationPipe` (§3.1) ↔ OpenAPI drift
   check (§8.8) ↔ frontend forms (§2.4) — one schema, one validator, no second source of truth.
4. **Database roles:** runtime connects only as `nexaerp_app` (§4.4) ↔ migrations use the owner
   via `DIRECT_URL` (§4.6, ADR-013) ↔ therefore RLS genuinely applies to runtime queries (§6.3)
   ↔ `audit_logs` is append-only for the app role (§4.4, §7.5).
5. **Single-instance assumption:** in-process rate limiting (§8.7, ADR-012) ↔ startup migrations
   (`AUTO_MIGRATE`, §4.1) ↔ small Prisma pool (§4.5) ↔ keep-alive ping (§14.4) — all four state
   the same v1 constraint and name the same upgrade triggers (§15.4).
6. **Deployment:** Vercel serves only `apps/web` (§14.1) ↔ `NEXT_PUBLIC_*` is the only
   browser-exposed env prefix (§17) ↔ API secrets live only on Render (§11.5) ↔ CORS allowlist
   knows only the web origins (§14.3).
7. **Testing claims:** no phase claims completion without green gates (§12.4) ↔ CI enforces the
   same gates (§14.2) ↔ Phase 0 delivers only this document (§18).
8. **Free-tier math:** two Supabase projects exactly match dev + prod (§5.1) ↔ Render 750 hours
   covers one always-on-equivalent instance plus keep-alive (§15.1) ↔ budget stays $0 (§15).

Any future change to one side of these pairs must update the other in the same commit.

