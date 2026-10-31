-- Additive migration for the RPCs used by the current browser client.
-- Run on an existing Vectra database. Does not remove player data.
alter table public.profiles add column if not exists terms_version int not null default 0;
alter table public.profiles add column if not exists terms_at timestamptz;
alter table public.profiles add column if not exists verified_until timestamptz;
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create or replace function public.get_me()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.profiles; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  p := public.ensure_profile();
  return jsonb_build_object(
    'nickname', p.nickname, 'nickname_set', p.nickname_set,
    'changed_at', p.nickname_changed_at,
    'terms', p.terms_version,
    'verified_until', case when p.verified_until > now() then (extract(epoch from p.verified_until) * 1000)::bigint else 0 end,
    'prefs', p.prefs,
    'best', (select coalesce(max(score), 0) from public.game_runs where user_id = uid),
    'streak', (select jsonb_build_object('current', case when last_played >= (now() at time zone 'utc')::date - 1 then current_streak else 0 end, 'best', best_streak, 'last', last_played) from public.streaks where user_id = uid),
    'daily', (select coalesce(jsonb_object_agg(day::text, jsonb_build_object('g', guess, 's', score)), '{}'::jsonb) from public.daily_answers where user_id = uid)
  );
end $$;

create or replace function public.set_prefs(p_theme text default null, p_lang text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_theme is not null and p_theme not in ('light', 'dark') then raise exception 'invalid_theme'; end if;
  if p_lang is not null and p_lang not in ('ru', 'en') then raise exception 'invalid_lang'; end if;
  perform public.ensure_profile();
  update public.profiles set prefs = prefs || jsonb_strip_nulls(jsonb_build_object('theme', p_theme, 'lang', p_lang)), updated_at = now() where id = auth.uid();
end $$;

create or replace function public.accept_terms(p_version int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_version is null or p_version < 1 or p_version > 1000 then raise exception 'invalid_version'; end if;
  perform public.ensure_profile();
  update public.profiles set terms_version = greatest(terms_version, p_version), terms_at = now(), updated_at = now() where id = auth.uid();
end $$;

-- This is only a remembered UX checkpoint. It is not proof of a human visitor.
create or replace function public.set_verified(p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.ensure_profile();
  update public.profiles set verified_until = case when p_on then now() + interval '12 hours' else null end where id = auth.uid();
end $$;

create or replace function public.get_daily(p_day date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.daily_answers;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_day is null or p_day > (now() at time zone 'utc')::date then raise exception 'invalid_day'; end if;
  select * into a from public.daily_answers where user_id = auth.uid() and day = p_day;
  if not found then return jsonb_build_object('answered', false); end if;
  return jsonb_build_object('answered', true, 'g', a.guess, 's', a.score, 'truth', a.truth);
end $$;

revoke execute on function public.get_me() from public, anon;
revoke execute on function public.set_prefs(text, text) from public, anon;
revoke execute on function public.accept_terms(int) from public, anon;
revoke execute on function public.set_verified(boolean) from public, anon;
revoke execute on function public.get_daily(date) from public, anon;
grant execute on function public.get_me() to authenticated;
grant execute on function public.set_prefs(text, text) to authenticated;
grant execute on function public.accept_terms(int) to authenticated;
grant execute on function public.set_verified(boolean) to authenticated;
grant execute on function public.get_daily(date) to authenticated;
