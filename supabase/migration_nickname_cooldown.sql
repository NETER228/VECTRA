-- ============================================================================
--  VECTRA — миграция: ограничение смены никнейма (1 раз в 3 дня) и лидерборд «Daily · всего».
--  Для базы, где schema.sql уже выполнялся: данные НЕ удаляются. Выполнить целиком в SQL Editor.
--  (На чистой базе достаточно schema.sql — он уже содержит всё это.)
-- ============================================================================
alter table public.profiles add column if not exists nickname_set boolean not null default false;
alter table public.profiles add column if not exists nickname_changed_at timestamptz;

drop function if exists public.set_nickname(text);
drop function if exists public.set_nickname(text, boolean);
create function public.set_nickname(p_nick text, p_initial boolean default false)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare p public.profiles; first_time boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  p_nick := btrim(coalesce(p_nick, ''));
  if char_length(p_nick) not between 3 and 20 or p_nick !~ '^[A-Za-z0-9А-Яа-яЁё_.-]+$' then raise exception 'invalid_nickname'; end if;
  perform public.ensure_profile();
  select * into p from public.profiles where id = auth.uid() for update;
  first_time := p_initial and not p.nickname_set;
  if not first_time and p.nickname_changed_at is not null and p.nickname_changed_at > now() - interval '3 days' then
    raise exception 'nickname_cooldown:%', to_char((p.nickname_changed_at + interval '3 days') at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  begin
    update public.profiles
       set nickname = p_nick, nickname_set = true, updated_at = now(),
           nickname_changed_at = case when first_time then nickname_changed_at else now() end
     where id = auth.uid() returning * into p;
  exception when unique_violation then
    raise exception 'nickname_taken';
  end;
  return p;
end $$;


-- Вся личная статистика одним запросом
create or replace function public.get_my_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); out jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  perform public.ensure_profile();
  select jsonb_build_object(
    'profile', (select jsonb_build_object('nickname', nickname, 'created_at', created_at, 'changed_at', nickname_changed_at) from public.profiles where id = uid),
    'streak',  (select jsonb_build_object('current', current_streak, 'best', best_streak, 'last', last_played) from public.streaks where user_id = uid),
    'compare', (select jsonb_build_object('runs', count(*), 'best', coalesce(max(score), 0), 'avg', coalesce(round(avg(score)), 0), 'total', coalesce(sum(score), 0)) from public.game_runs where user_id = uid and mode = 'compare'),
    'weight',  (select jsonb_build_object('runs', count(*), 'best', coalesce(max(score), 0), 'avg', coalesce(round(avg(score)), 0), 'total', coalesce(sum(score), 0)) from public.game_runs where user_id = uid and mode = 'weight'),
    'rounds',  (select jsonb_build_object('count', count(*), 'avg', coalesce(round(avg(rr.score)), 0)) from public.run_rounds rr join public.game_runs gr on gr.id = rr.run_id where gr.user_id = uid),
    'daily',   (select jsonb_build_object('answered', count(*), 'avg', coalesce(round(avg(score)), 0), 'best', coalesce(max(score), 0), 'perfect', count(*) filter (where score >= 95)) from public.daily_answers where user_id = uid),
    'recent',  (select coalesce(jsonb_agg(jsonb_build_object('mode', x.mode, 'score', x.score, 't', x.t) order by x.t desc), '[]'::jsonb)
                  from (select * from (
                          select mode, score, played_at as t from public.game_runs where user_id = uid
                          union all
                          select 'daily', score, answered_at from public.daily_answers where user_id = uid
                        ) u order by t desc limit 20) x)
  ) into out;
  return out;
end $$;


drop view if exists public.leaderboard_daily_total;
create view public.leaderboard_daily_total as
  select p.nickname, sum(a.score)::int as total, count(*)::int as answered from public.daily_answers a join public.profiles p on p.id = a.user_id
   group by p.id, p.nickname order by total desc, answered asc limit 100;

revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on function public.ensure_profile()                                            to authenticated;
grant  execute on function public.set_nickname(text, boolean)                                 to authenticated;
grant  execute on function public.submit_daily(date, int, double precision, double precision) to authenticated;
grant  execute on function public.submit_run(text, jsonb)                                     to authenticated;
grant  execute on function public.get_my_stats()                                              to authenticated;
grant select on public.leaderboard_daily_total to anon, authenticated;
