-- Multi-server Discord activity support.
-- Run this migration after schema.sql and the original discord_activity.sql.
-- The service-role key stays only on the private bot host.

-- Discord-created communities do not require a Supabase Auth account.
alter table public.communities
  alter column created_by drop not null;

create or replace function public.bootstrap_community()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;

  insert into public.community_state (community_id, updated_by)
  values (new.id, new.created_by);

  return new;
end;
$$;

create table if not exists public.discord_guilds (
  guild_id text primary key,
  community_id uuid not null unique
    references public.communities(id) on delete cascade,
  guild_name text not null,
  configured_by text not null,
  configured_at timestamptz not null default now()
);

alter table public.discord_guilds enable row level security;

create or replace function public.register_discord_guild(
  p_guild_id text,
  p_guild_name text,
  p_configured_by text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_community uuid;
  new_community uuid;
  safe_name text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  if p_guild_id is null or p_guild_id !~ '^[0-9]{17,20}$' then
    raise exception 'Invalid Discord server ID';
  end if;
  if p_configured_by is null or p_configured_by !~ '^[0-9]{17,20}$' then
    raise exception 'Invalid Discord user ID';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_guild_id));

  select community_id into existing_community
  from public.discord_guilds
  where guild_id = p_guild_id
  for update;

  safe_name := left(trim(coalesce(p_guild_name, 'Servidor de Discord')), 60);
  if char_length(safe_name) < 2 then
    safe_name := 'Servidor de Discord';
  end if;

  if existing_community is not null then
    update public.discord_guilds
    set guild_name = safe_name,
        configured_by = p_configured_by,
        configured_at = now()
    where guild_id = p_guild_id;
    return existing_community;
  end if;

  insert into public.communities (name, slug, created_by)
  values (
    safe_name,
    'discord-' || p_guild_id,
    null
  )
  returning id into new_community;

  insert into public.discord_guilds (
    guild_id, community_id, guild_name, configured_by
  )
  values (
    p_guild_id, new_community, safe_name, p_configured_by
  );

  return new_community;
end;
$$;

revoke all on function public.register_discord_guild(text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_discord_guild(text, text, text)
  to service_role;

-- Only the private service-role bot can read or change the guild mapping.
revoke all on public.discord_guilds from anon, authenticated;
