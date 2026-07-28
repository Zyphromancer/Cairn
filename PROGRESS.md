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

## Phase 2 addendum — Markdown input rules ✅ (moved out of Deferred)

Typing a trigger as the entire text of an empty paragraph block converts
it in place and consumes the trigger: `# `/`## `/`### ` → h1–h3,
`- `/`* ` → bulleted list, `1. ` → numbered list, `[] `/`[x] ` → to-do
(unchecked/checked), `> ` → quote, `` ``` `` → code, `---` → divider
(which also inserts and focuses a fresh paragraph after itself, since a
divider isn't editable).

Design notes:
- Matching is against the block's *entire* plain text
  (`src/lib/blocks/markdown-rules.ts`), not a cursor-anchored input rule —
  which gives "only at position 0 of an otherwise empty block, never
  mid-text" for free, and makes `#hashtag` (no trailing space) a
  non-match by construction. Code blocks can't fire rules at all (they
  don't route through the TipTap update path).
- Cursor stays in the converted block via the same `requestAutoFocus`
  remount fix as slash-menu conversions (a type change alters the
  wrapper JSX, which remounts the editor instance).
- Cmd/Ctrl+Z immediately after a conversion reverts it and restores the
  literal trigger text. This is an app-level one-shot undo record, not
  ProseMirror's history — the remount that comes with a type change
  destroys the editor instance and its native undo stack, so the block
  editor keeps a `lastConversion` record (invalidated the moment the
  block is edited again) and intercepts the next undo keypress.
- A real TipTap v3 gotcha found while wiring this: `clearContent()`
  defaults to `emitUpdate: true`, which synchronously re-enters the
  update handler with the emptied doc — scheduling a stale save and
  clobbering the undo record. `RichText`'s `clearContent` now always
  passes `false`; every caller clears as part of a larger app-level
  change that manages its own persistence.
- Playwright coverage: one test per trigger (11), a negative test that
  `#hashtag` doesn't convert, and an undo-restores-the-text test —
  `e2e/markdown-input-rules.spec.ts`, sharing a new `e2e/helpers.ts`
  sign-in helper with the existing specs.

## Pre-Phase-3 addendum — Minimal installable PWA ✅

- `src/app/manifest.ts`: name/short_name "Cairn", `display: "standalone"`,
  `theme_color`/`background_color` pulled from the default theme preset
  (`cairnDefaultTheme.colors.bg`) rather than a hardcoded hex, 192×192 and
  512×512 icons (`public/icon-192.png`, `public/icon-512.png` — a simple
  gold three-stone cairn glyph on the theme's near-black, generated via
  `sharp` since there's no brand mark yet), plus a `purpose: "maskable"`
  variant of the 512 icon.
- `public/sw.js`: minimal app-shell service worker — precaches `/login`,
  the manifest, and both icons on install; network-first for navigations
  with a `/login` fallback when offline; cache-first for hashed
  `/_next/static/` assets. No offline data sync (Dexie's queue already
  covers pending writes at the app layer) — this is install-criteria
  scope only, as asked.
- `src/components/pwa/register-sw.tsx`: registers the service worker,
  production-only (`NODE_ENV === "production"`) — a service worker
  intercepting Turbopack's dev-only HMR/on-demand-compiled asset
  requests causes far more confusion than it's worth, and install
  criteria only matter for the deployed build anyway.
- `layout.tsx` also sets `appleWebApp: { capable: true, ... }` metadata
  (Safari doesn't fully respect the manifest's `display: standalone`;
  this emits the `apple-mobile-web-app-*` tags Add to Home Screen needs
  to launch iPad/iPhone without browser chrome) and a `viewport.themeColor`
  matching the theme.

**A real bug this caught:** the auth proxy's matcher excluded static
image extensions but not `manifest.webmanifest` or `sw.js` — both got
routed through `updateSession`, which redirected the *signed-out*
fetch for the manifest itself to `/login`, since neither path was in
`PUBLIC_PATHS`. That's fatal for installability: browsers (and the
service worker) must be able to fetch the manifest and its icons with
no session at all, including from `/login` before anyone's signed in.
Fixed by excluding both from the proxy's matcher entirely (`src/proxy.ts`)
rather than adding them to `PUBLIC_PATHS` — they need no auth-cookie
handling whatsoever, unlike the two paths already there.

**What's verified vs. what needs a manual check:** Playwright
(`e2e/pwa.spec.ts`) confirms the manifest is linked and fetchable
unauthenticated, has the right `display`/colors/icon sizes, and that the
service worker registers, activates, and populates the shell cache —
everything machine-checkable in headless Chromium. The actual install
UI (Chrome/Edge's install icon, iPadOS's Add to Home Screen behavior)
can't fire in headless automation or on a local, non-HTTPS origin
(browsers require a secure context to consider a page installable) — it
needs a manual check once this is deployed to a real HTTPS URL, which
is the other pending pre-Phase-3 task.

## Pre-Phase-3 addendum — Deploy ✅ (hosted Supabase + Vercel)

- **Hosted Supabase**: project `cairn` (ref `bbtbiojnsvwoszybhevo`, region
  `eu-west-1`, under the Athera Solutions org). Both migrations applied
  and verified via `information_schema` (all six `public` tables present,
  RLS intact). `supabase_migrations.schema_migrations` was seeded by hand
  with both migration versions so a future `supabase link && supabase db
  push` from a machine with real Postgres access recognizes them as
  already applied instead of re-running them.
- **Vercel**: project `cairn`, linked to `Zyphromancer/Cairn` with
  `main` as the production branch (the Vercel-for-GitHub app was already
  installed on this account from a prior project, so no manual OAuth
  step was needed). All four `.env.example` vars set for
  production/preview/development — `DATABASE_URL` points at the
  pooled connection (`aws-0-eu-west-1.pooler.supabase.com:6543`,
  transaction mode), not the direct one, since serverless functions need
  pooling rather than long-lived connections.
- **Supabase Auth config** updated: `site_url` and the redirect
  allow-list now include the production domain (previously local-only),
  so magic-link emails resolve correctly in production.
- PR #1 was still a draft sitting on top of an unmerged `main` — deploying
  literal `main` would've shipped an empty scaffold. Marked ready and
  merged (squash) before deploying, per your call.

**Two real bugs/gaps this caught:**
1. **Vercel Deployment Protection (Vercel Authentication/SSO) is on by
   default** for every project on this team, gating the `*.vercel.app`
   domain behind a Vercel-account login wall. Left on, the app would
   have been completely inaccessible to any real visitor. Disabled it
   at the project level (`ssoProtection: null`).
2. The Supabase CLI (`supabase link`/`db push`) is a Go binary that
   doesn't honor this environment's HTTPS proxy — confirmed via the
   proxy's own diagnostics (zero relay-failure records, meaning the
   request never reached the proxy at all: a "hand-rolled Go dialer"
   bypassing `HTTPS_PROXY` entirely). Worked around it correctly per the
   proxy's own guidance (report/reroute, don't disable protections) by
   driving the Supabase **Management API** directly over HTTPS instead
   — including its `/database/query` endpoint, which executes arbitrary
   SQL and let the migrations apply without ever needing a raw Postgres
   connection (also not proxy-supported). `supabase link` itself is
   still worth running from a machine with normal network access at
   some point, purely so local tooling (`supabase db diff`, Studio
   deep-links) recognizes the linked project — nothing about the app
   depends on it.

**Also found: headless Chromium in this sandbox cannot reach the public**
**internet at all** (confirmed against `example.com`, not specific to
this app) — every Playwright run all session had only ever hit
`localhost`, which bypasses the proxy. So the literal "confirm in a
browser" verification had to be done a different way: replayed the
exact authenticated calls the app's own server actions make (the
`create_workspace` RPC, then a `pages`/`blocks` insert under RLS) using
a real session obtained via GoTrue's admin `generate_link`, then
fetched the resulting page fresh over HTTP with that session's cookie —
confirming the production Next.js deployment on real hosted Postgres
renders exactly what was written, i.e. genuine persistence across a
reload. All verification workspaces/pages/blocks/users were deleted
afterward; production is clean.

**What's verified:**
- Deployed URL loads and returns the app shell (not the SSO wall).
- Magic-link verify → session cookie → authenticated redirect works
  end-to-end against the hosted project.
- A workspace + page + block created via the real RLS-enforced path
  persist and are correctly rendered on a fresh, independent fetch.

**What still needs you, since I have no working browser here:**
- The actual install-prompt UI from Task 2 (Chrome/Edge's install icon,
  iPadOS's Add to Home Screen) — the manifest/service-worker mechanics
  are Playwright-verified, but seeing the browser chrome itself needs a
  real device.
- A real magic-link click-through in your own inbox, as a sanity check
  beyond the admin-API-generated one used above.
- `supabase link --project-ref bbtbiojnsvwoszybhevo` from your own
  machine, whenever convenient — not blocking, just nice for local
  tooling to recognize the linked project.
