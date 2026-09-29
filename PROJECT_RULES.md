# NexaERP Project Rules

Build NexaERP as a professional portfolio-grade Enterprise ERP/HRMS.

## Stack

* Next.js
* React
* TypeScript
* NestJS
* PostgreSQL
* Prisma
* Supabase
* Tailwind CSS
* Docker
* GitHub Actions
* Vercel

## Rules

* Build phase-by-phase.
* Do not build the entire project at once.
* Use modular monolith architecture.
* Use PostgreSQL + Prisma.
* Implement proper multi-tenancy.
* Implement server-side RBAC.
* Never trust frontend authorization.
* Never hard-code secrets.
* Never commit `.env` files.
* Use TypeScript strictly.
* Avoid unnecessary dependencies.
* Do not create fake/placeholder functionality.
* Every important feature must be tested.
* Keep the UI professional, responsive and accessible.
* Prefer free/open-source services.
* Keep the project deployable on free tiers where practical.
* Do not move to the next phase automatically.
* Never claim something is complete without testing it.

## Development Process

Before implementing anything:

1. Read this file.
2. Read the relevant architecture/documentation.
3. Inspect the existing code.
4. Implement only the requested phase.
5. Run lint.
6. Run typecheck.
7. Run tests.
8. Fix errors.
9. Update documentation.
10. Report what was completed.

Never rewrite working code unnecessarily.
