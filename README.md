# Cairn

A calm, adaptable workspace — a Notion-style tool built around nested pages,
a block editor, and (in later phases) an AI layer, adaptive theming, and a
neurodivergent-friendly design ethos. See `PROGRESS.md` for what's shipped
per phase.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (local via CLI/Docker): Postgres, Auth (magic link), Storage,
  Realtime — pgvector enabled from the first migration for Phase 8
- **Drizzle ORM** for typed queries against the schema; the DDL of record
  lives in hand-written, RLS-aware SQL migrations under `supabase/migrations`
- A **ThemeToken** system: every color/font/spacing value is a CSS custom
  property compiled from a single token object (`src/lib/theme`) — no
  hardcoded colors anywhere in the app, enforced by a local ESLint rule

## Getting started

Requires Docker (for local Supabase) and Node 20+.

```bash
npm install
npx supabase start   # spins up local Postgres/Auth/Storage — prints local keys
cp .env.example .env.local   # if not already present, fill in the printed keys
npm run dev
```

Open http://localhost:3000. Magic-link emails sent in local dev land in
Mailpit at http://127.0.0.1:54324 (no real SMTP needed).

Supabase Studio (browse tables, run SQL) is at http://127.0.0.1:54323.

### Useful commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint (includes the no-hardcoded-color rule)
- `npm run test:e2e` — Playwright end-to-end suite (needs the dev server
  and local Supabase running)
- `npx supabase db reset` — recreate the local DB from migrations
- `npm run db:studio` — Drizzle Studio, for browsing via the typed schema

## Project layout

- `supabase/migrations/` — schema, RLS policies, and Postgres functions
  (source of truth for the database)
- `src/lib/db/schema.ts` — Drizzle schema mirroring the migrations, for
  typed server-side queries
- `src/lib/theme/` — the ThemeToken schema, the default "Cairn" preset, and
  the compiler that turns tokens into CSS custom properties
- `src/lib/supabase/` — browser/server Supabase clients and the session-
  refresh helper used by `src/proxy.ts`
- `e2e/` — Playwright tests
