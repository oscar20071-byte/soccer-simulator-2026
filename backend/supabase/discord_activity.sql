-- Discord activity statistics for Soccer Simulator 2026.
-- Run after backend/supabase/schema.sql. The bot uses service-role credentials
-- only on its private host; never expose that key in the browser.

create table if not exists public.discord_activity_daily (
  community_id uuid not null references public.communities(id) on delete cascade,
  discord_user_id text not null,
  activity_date date not null,
  message_count integer not null default 0 check (message_count >= 0),
  voice_minutes integer not null default 0 check (voice_minutes >= 0),
  updated_at timestamptz not null default now(),
  primary key (community_id, discord_user_id, activity_date)
);

create index if not exists discord_activity_daily_leaderboard
  on public.discord_activity_daily (community_id, activity_date desc);

create table if not exists public.discord_voice_sessions (
  guild_id text not null,
  discord_user_id text not null,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id text not null,
  joined_at timestamptz not null default now(),
  primary key (guild_id, discord_user_id)
);

create table if not exists public.discord_activity_preferences (
  community_id uuid not null references public.communities(id) on delete cascade,
  discord_user_id text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (community_id, discord_user_id)
);

alter table public.discord_activity_daily enable row level security;
alter table public.discord_voice_sessions enable row level security;
alter table public.discord_activity_preferences enable row level security;

drop policy if exists "discord_activity_read_members" on public.discord_activity_daily;
create policy "discord_activity_read_members"
on public.discord_activity_daily for select to authenticated
using (public.is_community_member(community_id));

-- No authenticated-user policies for voice sessions or preferences.
-- Writes are performed only by the private bot using the service-role key.

create or replace function public.record_discord_message(
  p_community_id uuid,
  p_discord_user_id text,
  p_activity_date date
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  insert into public.discord_activity_daily
    (community_id, discord_user_id, activity_date, message_count)
  values (p_community_id, p_discord_user_id, p_activity_date, 1)
  on conflict (community_id, discord_user_id, activity_date)
  do update set
    message_count = public.discord_activity_daily.message_count + 1,
    updated_at = now();
end;
$$;

create or replace function public.start_discord_voice_session(
  p_community_id uuid,
  p_guild_id text,
  p_discord_user_id text,
  p_channel_id text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;
  insert into public.discord_voice_sessions
    (guild_id, discord_user_id, community_id, channel_id)
  values (p_guild_id, p_discord_user_id, p_community_id, p_channel_id)
  on conflict (guild_id, discord_user_id) do nothing;
end;
$$;

create or replace function public.finish_discord_voice_session(
  p_guild_id text,
  p_discord_user_id text,
  p_ended_at timestamptz
)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  session_row public.discord_voice_sessions%rowtype;
  minutes_spent integer;
  day_ended date;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Not authorized';
  end if;

  select * into session_row
  from public.discord_voice_sessions
  where guild_id = p_guild_id and discord_user_id = p_discord_user_id
  for update;

  if not found then
    return 0;
  end if;

  delete from public.discord_voice_sessions
  where guild_id = p_guild_id and discord_user_id = p_discord_user_id;

  minutes_spent := greatest(0, floor(extract(epoch from (p_ended_at - session_row.joined_at)) / 60)::integer);
  day_ended := (p_ended_at at time zone 'UTC')::date;

  if minutes_spent > 0 then
    insert into public.discord_activity_daily
      (community_id, discord_user_id, activity_date, voice_minutes)
    values
      (session_row.community_id, p_discord_user_id, day_ended, minutes_spent)
    on conflict (community_id, discord_user_id, activity_date)
    do update set
      voice_minutes = public.discord_activity_daily.voice_minutes + excluded.voice_minutes,
      updated_at = now();
  end if;

  return minutes_spent;
end;
$$;

revoke all on function public.record_discord_message(uuid, text, date) from public, anon, authenticated;
revoke all on function public.start_discord_voice_session(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.finish_discord_voice_session(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_discord_message(uuid, text, date) to service_role;
grant execute on function public.start_discord_voice_session(uuid, text, text, text) to service_role;
grant execute on function public.finish_discord_voice_session(text, text, timestamptz) to service_role;
