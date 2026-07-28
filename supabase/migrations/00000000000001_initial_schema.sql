-- Cairn — Phase 1: extensions, profiles, workspaces, membership, RLS.

-- === Extensions ===
-- pgvector is enabled now so Phase 8's embeddings work needs no destructive
-- migration later. Nothing writes to vector columns until then.
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- === Roles ===
create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');

-- === Profiles ===
-- Mirrors auth.users so we can join/display user info under RLS without
-- exposing the auth schema directly.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever a new auth user is created (magic link
-- sign-up included).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- === Workspaces ===
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  icon text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

-- === Workspace members ===
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

-- Security-definer helpers so membership checks don't recurse through RLS
-- on workspace_members itself.
create function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = p_user_id
  );
$$;

create function public.workspace_role_of(p_workspace_id uuid, p_user_id uuid)
returns public.workspace_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
$$;

-- Workspaces: visible to members; insertable by any authenticated user
-- (they become owner immediately after via a member row); mutable by
-- owner/admin only.
create policy "members can view their workspaces"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id, auth.uid()));

create policy "authenticated users can create workspaces"
  on public.workspaces for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "owners and admins can update workspace"
  on public.workspaces for update
  to authenticated
  using (public.workspace_role_of(id, auth.uid()) in ('owner', 'admin'))
  with check (public.workspace_role_of(id, auth.uid()) in ('owner', 'admin'));

create policy "owners can delete workspace"
  on public.workspaces for delete
  to authenticated
  using (public.workspace_role_of(id, auth.uid()) = 'owner');

-- Workspace members: visible to other members of the same workspace;
-- managed by owner/admin. The very first "owner" row for a new workspace
-- is created by create_workspace() below (security definer, bypasses RLS)
-- rather than through this policy.
create policy "members can view workspace membership"
  on public.workspace_members for select
  to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "owners and admins can add members"
  on public.workspace_members for insert
  to authenticated
  with check (public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin'));

create policy "owners and admins can update member roles"
  on public.workspace_members for update
  to authenticated
  using (public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin'))
  with check (public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin'));

create policy "owners/admins can remove members, members can leave"
  on public.workspace_members for delete
  to authenticated
  using (
    public.workspace_role_of(workspace_id, auth.uid()) in ('owner', 'admin')
    or user_id = auth.uid()
  );

-- Creates a workspace and its first "owner" membership row atomically.
-- Security definer so it isn't blocked by the chicken-and-egg RLS problem
-- of the creator not being a member yet at the instant the workspace row
-- is created (and thus, per the SELECT policy above, unable to see the
-- row an INSERT ... RETURNING would need to return).
create function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
begin
  insert into public.workspaces (name, slug, created_by)
  values (p_name, p_slug, auth.uid())
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, auth.uid(), 'owner');

  return v_workspace;
end;
$$;

grant execute on function public.create_workspace(text, text) to authenticated;

-- Keep updated_at fresh.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute procedure public.set_updated_at();

-- === Grants ===
-- New tables are no longer auto-exposed to the Data API roles by default.
-- RLS policies above define *which* rows are visible; these grants define
-- that the role may touch the table at all.
grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
