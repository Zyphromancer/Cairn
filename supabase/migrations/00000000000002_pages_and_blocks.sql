-- Cairn — Phase 2: pages (with nesting + trash) and blocks.

-- === Pages ===
-- `visibility` gives us real Private vs Workspace pages now without
-- waiting for Phase 4's full sharing/ACL model: a private page is visible
-- only to its creator, a workspace page to every workspace member. The
-- sidebar's Favorites/Private/Workspace/Trash sections read directly off
-- this plus page_favorites and archived_at — no fake sections.
create type public.page_visibility as enum ('private', 'workspace');

create table public.pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  parent_page_id uuid references public.pages (id) on delete cascade,
  title text not null default '',
  icon text,
  cover_url text,
  visibility public.page_visibility not null default 'workspace',
  position double precision not null default 0,
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_workspace_id_idx on public.pages (workspace_id);
create index pages_parent_page_id_idx on public.pages (parent_page_id);

alter table public.pages enable row level security;

-- Whether p_user_id can see p_page_id at all (workspace member on a
-- workspace-visibility page, or the creator on a private one).
create function public.can_view_page(p_page_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pages p
    where p.id = p_page_id
    and (
      (p.visibility = 'workspace' and public.is_workspace_member(p.workspace_id, p_user_id))
      or (p.visibility = 'private' and p.created_by = p_user_id)
    )
  );
$$;

-- Whether p_user_id can edit p_page_id's content/blocks (same visibility
-- rule, but guests are read-only on workspace pages).
create function public.can_edit_page(p_page_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pages p
    where p.id = p_page_id
    and (
      (p.visibility = 'workspace' and public.workspace_role_of(p.workspace_id, p_user_id) in ('owner', 'admin', 'member'))
      or (p.visibility = 'private' and p.created_by = p_user_id)
    )
  );
$$;

create policy "accessible pages are visible"
  on public.pages for select
  to authenticated
  using (
    (visibility = 'workspace' and public.is_workspace_member(workspace_id, auth.uid()))
    or (visibility = 'private' and created_by = auth.uid())
  );

create policy "members (not guests) can create pages"
  on public.pages for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin', 'member')
  );

create policy "editors can update pages"
  on public.pages for update
  to authenticated
  using (public.can_edit_page(id, auth.uid()))
  with check (
    (visibility = 'workspace' and public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin', 'member'))
    or (visibility = 'private' and created_by = auth.uid())
  );

create policy "editors can delete pages"
  on public.pages for delete
  to authenticated
  using (public.can_edit_page(id, auth.uid()));

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute procedure public.set_updated_at();

-- === Page favorites ===
-- Per-user, not per-workspace: a page can be favorited independently by
-- each member who can see it.
create table public.page_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  page_id uuid not null references public.pages (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, page_id)
);

alter table public.page_favorites enable row level security;

create policy "users manage their own favorites"
  on public.page_favorites for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_view_page(page_id, auth.uid()));

-- === Blocks ===
-- One row per top-level (or nested, via parent_block_id) block. `type` is
-- deliberately free text rather than an enum — new block types are added
-- often in early phases and an enum needs a migration per addition.
-- `content` shape is type-dependent and validated at the app layer; it
-- generally holds `{ doc: <tiptap json> }` for text-bearing blocks plus
-- type-specific fields (checked, expanded, icon, language, level, pageId).
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages (id) on delete cascade,
  parent_block_id uuid references public.blocks (id) on delete cascade,
  type text not null,
  content jsonb not null default '{}'::jsonb,
  position double precision not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blocks_page_id_idx on public.blocks (page_id);
create index blocks_parent_block_id_idx on public.blocks (parent_block_id);

alter table public.blocks enable row level security;

create policy "blocks visible with their page"
  on public.blocks for select
  to authenticated
  using (public.can_view_page(page_id, auth.uid()));

create policy "editors can create blocks"
  on public.blocks for insert
  to authenticated
  with check (created_by = auth.uid() and public.can_edit_page(page_id, auth.uid()));

create policy "editors can update blocks"
  on public.blocks for update
  to authenticated
  using (public.can_edit_page(page_id, auth.uid()))
  with check (public.can_edit_page(page_id, auth.uid()));

create policy "editors can delete blocks"
  on public.blocks for delete
  to authenticated
  using (public.can_edit_page(page_id, auth.uid()));

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute procedure public.set_updated_at();

-- === Grants ===
grant select, insert, update, delete on public.pages to authenticated;
grant select, insert, update, delete on public.page_favorites to authenticated;
grant select, insert, update, delete on public.blocks to authenticated;
