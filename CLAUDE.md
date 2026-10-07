@AGENTS.md

# Campus Asset QR & Maintenance Management System

The specification lives in `docs/` and is the source of truth. Before working on a
phase, read `docs/00-project-context.md`, `docs/17-claude-code-master-build-instructions.md`,
the roadmap in `docs/16-implementation-roadmap.md`, and the feature doc for that phase.
(Docs 00 and 17 cite older filenames; locate the matching document by content.)

- Stack: Next.js (App Router, `src/`), TypeScript, Tailwind CSS, Supabase (Auth, Postgres + RLS, Storage), Vercel. No separate backend server, no paid services.
- Build incrementally, one roadmap phase at a time; run `npm run check` and `npm run build` before calling a phase done.
- Never weaken RLS, never expose `SUPABASE_SERVICE_ROLE_KEY` to client code, never commit `.env.local`.
- The human developer owns Supabase/Vercel setup and credentials; we provide SQL migrations, policies, seed data, code, and setup instructions.
