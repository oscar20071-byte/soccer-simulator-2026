-- Soccer Simulator 2026 · Portal multi-comunidad
-- Ejecutar en Supabase SQL Editor. No contiene claves ni credenciales.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner','admin','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table if not exists public.community_state (
  community_id uuid primary key references public.communities(id) on delete cascade,
  state jsonb not null default
    '{"version":"2.1","season":2026,"teams":[],"players":[],"comps":[],"matches":[],"champions":[],"awards":[],"settings":{}}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  max_uses integer not null default 10 check (max_uses between 1 and 100),
  uses_count integer not null default 0 check (uses_count >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.is_community_member(target_community uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = target_community and user_id = auth.uid()
  );
$$;

create or replace function public.has_community_role(
  target_community uuid,
  allowed_roles text[]
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = target_community
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_state enable row level security;
alter table public.community_invites enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles for select to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "communities_read_members" on public.communities;
create policy "communities_read_members"
on public.communities for select to authenticated
using (public.is_community_member(id));

drop policy if exists "communities_create_self" on public.communities;
create policy "communities_create_self"
on public.communities for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "communities_update_admins" on public.communities;
create policy "communities_update_admins"
on public.communities for update to authenticated
using (public.has_community_role(id, array['owner','admin']))
with check (public.has_community_role(id, array['owner','admin']));

drop policy if exists "communities_delete_owner" on public.communities;
create policy "communities_delete_owner"
on public.communities for delete to authenticated
using (public.has_community_role(id, array['owner']));

drop policy if exists "members_read_community" on public.community_members;
create policy "members_read_community"
on public.community_members for select to authenticated
using (public.is_community_member(community_id));

drop policy if exists "members_manage_admins" on public.community_members;
create policy "members_manage_admins"
on public.community_members for all to authenticated
using (public.has_community_role(community_id, array['owner','admin']))
with check (public.has_community_role(community_id, array['owner','admin']));

drop policy if exists "state_read_members" on public.community_state;
create policy "state_read_members"
on public.community_state for select to authenticated
using (public.is_community_member(community_id));

drop policy if exists "state_write_staff" on public.community_state;
create policy "state_write_staff"
on public.community_state for all to authenticated
using (public.has_community_role(community_id, array['owner','admin','moderator']))
with check (public.has_community_role(community_id, array['owner','admin','moderator']));

drop policy if exists "invites_manage_admins" on public.community_invites;
create policy "invites_manage_admins"
on public.community_invites for all to authenticated
using (public.has_community_role(community_id, array['owner','admin']))
with check (public.has_community_role(community_id, array['owner','admin']));

-- Al crear una comunidad, su creador queda registrado como propietario
-- y se inicializa el estado compartido.
create or replace function public.bootstrap_community()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.community_members (community_id, user_id, role)
  values (new.id, new.created_by, 'owner');

  insert into public.community_state (community_id, updated_by)
  values (new.id, new.created_by);

  return new;
end;
$$;

drop trigger if exists on_community_created on public.communities;
create trigger on_community_created
after insert on public.communities
for each row execute function public.bootstrap_community();

-- Unirse requiere un código de invitación válido. El código original
-- nunca se almacena: solo se conserva su hash SHA-256.
create or replace function public.join_community_with_invite(invite_token text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  invite_row public.community_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  select * into invite_row
  from public.community_invites
  where token_hash = encode(digest(invite_token, 'sha256'), 'hex')
  for update;

  if not found
     or invite_row.expires_at <= now()
     or invite_row.uses_count >= invite_row.max_uses then
    raise exception 'La invitación no es válida o ha caducado.';
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (invite_row.community_id, auth.uid(), 'member')
  on conflict (community_id, user_id) do nothing;

  update public.community_invites
  set uses_count = uses_count + 1
  where id = invite_row.id;

  return invite_row.community_id;
end;
$$;

revoke all on function public.join_community_with_invite(text) from public;
grant execute on function public.join_community_with_invite(text) to authenticated;
