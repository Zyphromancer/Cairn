# Cairn build progress

## Phase 1 — Infrastructure ✅

**Built:**
- Next.js + TypeScript + Tailwind v4 scaffold
- Local Supabase via CLI/Docker: Postgres, Auth, Storage, Realtime, Studio,
  Mailpit (dev email capture). Edge Functions runtime disabled — this
  sandbox can't grant the file-descriptor ulimit it requests; re-enable in
  `supabase/config.toml` (`[edge_runtime] enabled`) wherever that's not an
  issue, e.g. most normal dev machines and hosted Supabase.
- First migration (`supabase/migrations/00000000000001_initial_schema.sql`):
  `pgvector` + `pg_trgm` extensions enabled (unused until Phase 8),
  `workspace_role` enum, `profiles` (mirrors `auth.users`), `workspaces`,
  `workspace_members`, full RLS on every table, a `create_workspace()`
  security-definer RPC (atomic workspace + owner-membership creation —
  needed to dodge a real RLS gotcha, see below), grants for the
  `authenticated` role (new Supabase default no longer auto-exposes tables).
- Drizzle schema (`src/lib/db/schema.ts`) mirroring the migration, for typed
  server-side queries. The migrations are the source of truth; Drizzle is
  the query layer.
- Auth: email magic link via `@supabase/ssr` (browser + server clients,
  `src/proxy.ts` for session refresh — Next 16 renamed `middleware.ts` to
  `proxy.ts`), `/login`, `/auth/callback` (handles both PKCE `code` and OTP
  `token_hash`), protected-route redirect.
- Workspaces: create, list on the home page, a workspace shell page at
  `/w/[slug]` with member list, role management (owner/admin can change
  roles or remove members), and invite-by-email (for users who've signed
  in at least once).
- ThemeToken system (the one Phase 10 piece pulled into Phase 1, per your
  instruction): Zod schema (`src/lib/theme/schema.ts`) covering colors,
  typography, geometry, motion, chrome; the default "Cairn" preset
  (`src/lib/theme/presets/cairn-default.ts`, bg `#0a0908` / text `#ede6d8`
  / accent `#b8923b`, Space Grotesk + Source Serif 4 + JetBrains Mono);
  a compiler turning tokens into CSS custom properties consumed by
  Tailwind's `@theme inline`; a local ESLint rule
  (`eslint-rules/no-hardcoded-color.mjs`) that hard-fails on any hex/rgb/hsl
  literal outside the theme preset files.
- Playwright installed and wired to the pre-installed Chromium (Phase 7
  asks for a Playwright suite — this is its start). 4 passing e2e tests
  covering magic-link sign-in, workspace creation/ownership, the
  signed-out redirect, and invite + role change.

**A real bug this caught, worth knowing about:** the original
`createWorkspace` action did `insert(...).select().single()`, which
implies a `RETURNING` clause. Under RLS, `RETURNING` is subject to the
table's `SELECT` policy — and the creator isn't a workspace member yet at
the instant the row is inserted, so the workspace was created but
invisible to its own creator, surfacing as a cryptic
`new row violates row-level security policy` error. Fixed by moving
workspace + first-owner-membership creation into one `SECURITY DEFINER`
Postgres function (`create_workspace`) that bypasses RLS internally. This
class of bug is worth remembering for every "insert a row the inserter
needs to immediately read back" case in later phases (e.g. Phase 2 page
creation, Phase 3 database rows).

**Deferred to later phases (as scoped):** everything else in the spec —
pages, the block editor, databases, collaboration, the platform layer, the
neurodivergent layer, and shipping — is Phase 2 onward, not started yet.

**What I made unilaterally, flag if you want it different:**
- Package/db-first name is `cairn` (lowercase; npm rejected the capitalized
  repo name).
- Invite-by-email requires the invitee to have signed in at least once
  (no "invite someone who's never used Cairn" flow yet — that needs either
  a real email-sending setup or a pending-invite table; picked the simpler
  path for Phase 1 and can build the fuller flow in Phase 4/5 if wanted).
- `site_url`/`additional_redirect_urls` in `supabase/config.toml` now allow
  both `127.0.0.1:3000` and `localhost:3000` wildcards, since Supabase's
  redirect allowlist otherwise silently drops the `/auth/callback` path
  for whichever hostname isn't listed.

**What I need from you:** nothing blocking — I'll keep moving into
Phase 2 (pages, sidebar, TipTap block editor) unless you want to redirect
first.
