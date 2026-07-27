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

## Phase 2 — Pages & Editor ✅ (core scope; several block types deferred)

**Built:**
- Migration 2 (`00000000000002_pages_and_blocks.sql`): `pages` (nesting
  via `parent_page_id`, trash via `archived_at`, `visibility`
  private/workspace), `page_favorites` (per-user), `blocks` (nesting via
  `parent_block_id`, free-text `type`, JSON `content`). Full RLS —
  private pages are visible only to their creator, workspace pages to
  any member; guests get read-only (can't insert/update/delete). An
  atomic `create_workspace`-style pattern wasn't needed here since page
  creators are already workspace members at insert time — no RLS
  chicken-and-egg this time.
- Sidebar: page tree with Favorites / Private / Workspace sections
  (real RLS-backed Private, not a fake label), Trash with restore/purge,
  collapsible nesting, drag-and-drop reorder and reparent (before/
  after/inside drop zones).
- Block editor: TipTap-based, one mini editor instance per block row
  (not one shared ProseMirror doc — needed for per-block persistence,
  and for later per-block comments/embeddings). Implemented: paragraph,
  heading (h1–3), bulleted/numbered list, to-do, toggle, quote, callout,
  divider, code, page_link, child_page. Slash menu (also searches
  existing pages to link to), markdown-style flow is via slash menu
  only for now (see deferred). Enter splits a block at the cursor
  (preserving marks via ProseMirror slices); Backspace-at-start merges
  into the previous block or deletes if empty; Tab/Shift+Tab
  indent/outdent; drag-handle reorder; turn-into via slash menu;
  @mentions (workspace members) via `@tiptap/extension-mention` +
  `@tiptap/suggestion` with a tippy.js popup. Autosave debounced 500ms
  for typing, immediate for structural changes (create/delete/move/
  turn-into).
- Dexie local-first layer, deliberately scoped down from "full
  offline": a `pendingWrites` queue that intercepts fire-and-forget
  mutations (content edits, moves, favorites, page property updates) —
  tries the server call immediately, queues to IndexedDB on failure,
  retries on reconnect/online event/30s interval. Creates
  (createBlock/createPage) generate client-side UUIDs so they're safe
  to queue too (no server round trip needed before the UI can use the
  new id) — the one exception is createPage/createChildPage, which stay
  direct/awaited since page ids drive an immediate navigation.

**Three real bugs found and fixed by actually exercising the editor
(not just reading the code), worth remembering for later phases:**
1. Updating a block's `content` in React state does **not** push into
   an already-mounted TipTap editor — `content` is a construction-time
   seed only. Merging on Backspace or truncating on Enter-split needs
   an explicit imperative `editor.commands.setContent(...)`
   (`RichText`'s new `setContent`/`appendDoc` methods), or the live
   editor silently shows stale text while React state says otherwise.
2. Converting a block to a different type (e.g. paragraph → heading)
   changes its wrapper JSX shape, which makes React unmount/remount the
   `RichText` instance rather than reuse it — silently dropping focus.
   Same thing happens when Tab/Shift+Tab moves a block into a different
   parent's children array (a different array = a different React
   parent = a remount, not a reorder). Fixed by re-arming an
   `autoFocus` target after any such move/conversion, and by adding a
   `hydrated` flag so any post-hydration (re)mount — new block or
   existing-block remount alike — can render its TipTap view
   synchronously instead of deferring, closing the focus-timing gap
   entirely.
3. A `flushSync`-based attempt at Enter's new-block focus timing made
   things worse, not better — reverted. What actually fixed the
   Enter-then-immediately-type race was making block creation fully
   optimistic (client-generated UUID, synchronous local state update)
   plus the `hydrated`-based immediate render, no `flushSync` needed.

**Deferred (explicitly, not accidentally):**
- Block types: image/video/audio/file (need a Storage upload pipeline),
  bookmark/embed, table, columns, synced block, TOC, breadcrumb, button.
- Markdown input rules (typing `# `, `- `, `1. `, `> `, `` ``` `` to
  auto-convert) — only the slash menu converts block types right now.
- Multi-block select (shift+click/shift+arrow range selection, bulk
  delete/format/turn-into).
- Full offline page/block *creation* while genuinely offline (client
  UUIDs make this close, but createPage/createChildPage still need a
  live round trip — see above).
- Drag-and-drop for blocks only supports before/after/inside within the
  loaded page; no cross-page drag.

**What I need from you:** nothing blocking. Next up would be Phase 3
(databases: properties, views, filters/sort, formulas, relations) unless
you'd rather redirect — e.g. toward filling in some of the deferred
block types first, since those come up constantly in real use.

## Tooling — CI + pnpm

- Switched the package manager from npm to pnpm (`packageManager` pinned
  in `package.json`, `pnpm-lock.yaml` committed) so `pnpm install
  --frozen-lockfile` works in CI.
- Added a `typecheck` script (`tsc --noEmit`).
- `.github/workflows/ci.yml`: install → typecheck → lint → build →
  `supabase start` → Playwright, on every push and pull request. Node 20.
  Playwright's HTML report uploads as a build artifact on failure.
- `playwright.config.ts` now has a `webServer` block (`pnpm start`,
  reused locally if already running, started fresh in CI) and no longer
  hardcodes this sandbox's pre-installed Chromium path — CI installs its
  own via `playwright install --with-deps chromium`.
