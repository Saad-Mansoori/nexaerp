# NexaERP

Self-hosted, open-source ERP foundation: organization, people, attendance and payroll
workflows in one workspace.

**Status: Phase 1 (Foundation)** — monorepo scaffold, API skeleton, shared contracts,
database migrations, CI/CD, Docker environment, architecture and migration docs.
Authentication, tenancy, RBAC and all business modules are Phase 2+.

The authoritative plan lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

| Layer       | Choice                                                                               |
| ----------- | ------------------------------------------------------------------------------------ |
| Monorepo    | pnpm 9.15 workspaces — `apps/api`, `apps/web`, `packages/shared`                     |
| API         | NestJS 11 + TypeScript 5.9 (strict), zod contracts, pino logging, helmet             |
| Database    | PostgreSQL 16 + Prisma 7 migrations                                                  |
| Web         | Next.js 16 (App Router) + React 19 + Tailwind 4                                      |
| Lint/format | ESLint 9 flat config + typescript-eslint, Prettier                                   |
| Tests       | Jest 30 (unit + integration, 75% integration coverage gate), Vitest 5 (web)          |
| CI          | GitHub Actions — lint, typecheck, unit tests, build, compose validation, integration |

## Prerequisites

- Node 24 (`.nvmrc` pins the exact version) with Corepack enabled: `corepack enable`
- pnpm 9.15 (declared in `packageManager`, installed automatically via Corepack)
- Docker with Compose v2
- PostgreSQL 16 (or just the provided Docker service)

## Getting started

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

- API: <http://localhost:4000/api/v1/health/ready>
- Web: <http://localhost:3000>

## Scripts

Run from the repository root:

| Script                                                      | What it does                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                                                  | Builds shared, then runs API and web in parallel                 |
| `pnpm build`                                                | Builds every workspace package                                   |
| `pnpm lint` / `pnpm format:check`                           | ESLint / Prettier check                                          |
| `pnpm typecheck`                                            | Type-checks all workspaces                                       |
| `pnpm test`                                                 | Unit tests (Jest + Vitest)                                       |
| `pnpm test:integration`                                     | API integration tests (needs a test database, coverage gate 75%) |
| `pnpm db:migrate` / `pnpm db:generate` / `pnpm db:validate` | Prisma migrations, client generation, schema validation          |

`db:seed`, `openapi:*` and `test:e2e` scripts are added in later phases (ARCHITECTURE §18).

## Integration tests

```bash
docker compose up -d postgres-test
pnpm test:integration
```

Integration tests read `TEST_DATABASE_URL` (defaults to the `postgres-test` service,
host port 5433) and run pending migrations before the suite. `DIRECT_URL` is used by the
migrator.

## Environment variables

Copy `.env.example` to `.env`. The full registry (web/API/CI-only, names, defaults) is
documented in [`docs/ARCHITECTURE.md` §17](docs/ARCHITECTURE.md). The API loads the root
`.env` itself (zod-validated, refuses to boot on invalid values) and never overrides
variables already present in the process environment.

## Docker Compose

| Profile | Services                                       | Command                                             |
| ------- | ---------------------------------------------- | --------------------------------------------------- |
| default | `postgres`, `api`, `web`                       | `docker compose up -d`                              |
| test    | `postgres-test` (host port 5433)               | `docker compose --profile test up -d postgres-test` |
| prod    | `postgres`, `api-prod` (multi-stage API image) | `docker compose --profile prod up -d`               |

Explicitly naming a service activates its profile: `docker compose up -d postgres-test`.
Validate the file with `docker compose config -q`.

## CI/CD

`.github/workflows/ci.yml` runs two jobs on every push/PR to `main`:

1. **quality** — install, format, lint, typecheck, unit tests, build, `prisma validate`,
   `docker compose config -q`, and a non-blocking `pnpm audit`.
2. **integration** — Postgres 16 service container, `pnpm test:integration` with the
   75% line-coverage gate.

OpenAPI drift checking is added in Phase 2 alongside `openapi:generate`/`openapi:check`.

Deploy targets:

- **Web** — Vercel (Root Directory `apps/web`, framework Next.js). Set
  `NEXT_PUBLIC_*` vars in the Vercel dashboard (never committed).
- **API** — Render, configured by [`render.yaml`](render.yaml) (Docker runtime, health
  check `/api/v1/health/ready`, secrets filled in the Render dashboard). Update
  `WEB_ORIGIN` to the deployed web origin.

## Repository layout

```
apps/
  api/          NestJS API + Prisma schema and migrations
  web/          Next.js public shell (auth/app shells arrive in later phases)
packages/
  shared/       zod contracts and stable error codes shared by both apps
docs/
  ARCHITECTURE.md   the authoritative plan (also migration plan + phase checklist)
```

## License

TBD.
