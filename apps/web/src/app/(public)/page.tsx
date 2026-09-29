const FEATURES = [
  {
    title: 'One source of truth',
    description:
      'Departments, locations and people are modelled once, then every module reads the same foundation.',
  },
  {
    title: 'Guardrails included',
    description:
      'Roles, permissions and an append-only audit trail are part of the core, not an afterthought.',
  },
  {
    title: 'Built to grow',
    description:
      'Attendance, leave, payroll and recruitment land on the same contracts, phase by phase.',
  },
] as const;

const ROADMAP = [
  { phase: 'Phase 1', status: 'Foundation: monorepo, API skeleton, database and CI' },
  { phase: 'Phase 2', status: 'Authentication, tenancy and role-based access control' },
  { phase: 'Phase 3+', status: 'App shell, organization, attendance, payroll and more' },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">NexaERP</span>
          <nav aria-label="Primary">
            <ul className="flex items-center gap-6 text-sm text-slate-600">
              <li>
                <a href="#features" className="hover:text-slate-900">
                  Features
                </a>
              </li>
              <li>
                <a href="#roadmap" className="hover:text-slate-900">
                  Roadmap
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section
          aria-labelledby="hero-heading"
          className="mx-auto max-w-6xl px-6 py-24 text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
            Open-source ERP foundation
          </p>
          <h1 id="hero-heading" className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            One workspace for people operations
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            NexaERP brings organization structure, employee records, attendance and payroll into a
            single modular platform you can host yourself.
          </p>
        </section>

        <section
          id="features"
          aria-labelledby="features-heading"
          className="border-t border-slate-200 bg-slate-50"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="features-heading" className="text-2xl font-semibold tracking-tight">
              Built on a foundation, not a framework
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="roadmap"
          aria-labelledby="roadmap-heading"
          className="border-t border-slate-200"
        >
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 id="roadmap-heading" className="text-2xl font-semibold tracking-tight">
              Roadmap
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {ROADMAP.map((item) => (
                <li key={item.phase} className="rounded-xl border border-slate-200 p-6">
                  <p className="text-sm font-semibold text-brand-600">{item.phase}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.status}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} NexaERP</p>
          <p>Self-hosted, open-source ERP foundation.</p>
        </div>
      </footer>
    </div>
  );
}
