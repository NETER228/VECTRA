-- ============================================================================
--  VECTRA — Supabase (Postgres). В базе хранится ТОЛЬКО статистика игроков.
--  Вопросы Daily Question лежат в data/questions.json, размеры и массы объектов — в js/compare.js и js/weight.js.
--
--  Как применить:
--   1) Authentication → Sign In / Providers → блок «User Signups» → включить «Allow anonymous sign-ins».
--      (Без этого сайт пишет в консоли «Anonymous sign-ins are disabled» и работает только локально.)
--   2) SQL Editor → вставить этот файл целиком → Run.
--
--  ВНИМАНИЕ: первый блок удаляет прежние таблицы Vectra (старую схему с daily_questions/objects). Если в них уже есть
--  данные, которые нужно сохранить, закомментируй блок «СБРОС».
--
--  Безопасность:
--   • Клиент (publishable-ключ) не может писать в таблицы напрямую — только через функции ниже, которые привязывают
--     данные к auth.uid() и сами пересчитывают очки по формуле.
--   • Секретный ключ (sb_secret_…) никогда не кладётся во фронтенд.
--   • Честность: правдивые значения приходят от клиента (они лежат в публичных файлах), поэтому таблицы лидеров защищены
--     от подделки только проверками диапазонов и лимитами частоты, а не криптографически.
-- ============================================================================

-- ---------- СБРОС старой схемы ----------
drop view  if exists public.leaderboard_compare, public.leaderboard_weight, public.leaderboard_daily_today, public.leaderboard_daily_total cascade;
drop table if exists public.run_rounds, public.game_runs, public.daily_answers, public.streaks, public.profiles, public.daily_questions, public.objects cascade;
drop function if exists public.calc_score(double precision, double precision);
drop function if exists public.bump_streak(uuid, date);
drop function if exists public.ensure_profile();
drop function if exists public.set_nickname(text);
drop function if exists public.set_nickname(text, boolean);
drop function if exists public.submit_daily(date, double precision);
drop function if exists public.submit_daily(date, int, double precision, double precision);
drop function if exists public.submit_run(text, jsonb);
drop function if exists public.get_my_stats();

-- ---------- профили (никнейм) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text not null,
  nickname_set        boolean not null default false,   -- человек уже выбирал ник при первом входе
  nickname_changed_at timestamptz,                      -- последняя ПЛАТНАЯ смена: ограничение 1 раз в 3 дня
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint nickname_len   check (char_length(nickname) between 3 and 20),
  constraint nickname_chars check (nickname ~ '^[A-Za-z0-9А-Яа-яЁё_.-]+$')
);
create unique index profiles_nickname_ci on public.profiles (lower(nickname));   -- ник уникален без учёта регистра

-- ---------- забеги по 5 раундов: Compare’It и Specify the weight ----------
create table public.game_runs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  mode       text not null check (mode in ('compare','weight')),
  score      int  not null check (score between 0 and 500),
  rounds     smallint not null default 5,
  played_at  timestamptz not null default now()
);
create index game_runs_user_time  on public.game_runs (user_id, played_at desc);
create index game_runs_mode_score on public.game_runs (mode, score desc);

-- раунды: key — что сравнивали ('earth>jupiter' для Compare’It, 'jupiter' для веса);
-- guess/truth — отношение размеров (compare) или масса в кг (weight)
create table public.run_rounds (
  id      bigint generated always as identity primary key,
  run_id  bigint not null references public.game_runs(id) on delete cascade,
  idx     smallint not null,
  key     text not null,
  guess   double precision not null check (guess > 0),
  truth   double precision not null check (truth > 0),
  score   smallint not null check (score between 0 and 100)
);
create index run_rounds_run on public.run_rounds (run_id);

-- ---------- ответы на вопрос дня (один на пользователя и день) ----------
create table public.daily_answers (
  user_id      uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  q_idx        int  not null,                       -- индекс в data/questions.json
  guess        double precision not null check (guess > 0),
  truth        double precision not null check (truth > 0),
  score        smallint not null check (score between 0 and 100),
  answered_at  timestamptz not null default now(),
  primary key (user_id, day)
);
create index daily_answers_day_score on public.daily_answers (day, score desc);

-- ---------- стрики ----------
create table public.streaks (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  current_streak  int  not null default 0,
  best_streak     int  not null default 0,
  last_played     date
);

-- ============================================================================
--  RLS: читать можно только своё; писать напрямую нельзя никому
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.game_runs     enable row level security;
alter table public.run_rounds    enable row level security;
alter table public.daily_answers enable row level security;
alter table public.streaks       enable row level security;

create policy "own profile" on public.profiles      for select to authenticated using (id = auth.uid());
create policy "own runs"    on public.game_runs     for select to authenticated using (user_id = auth.uid());
create policy "own rounds"  on public.run_rounds    for select to authenticated using (exists (select 1 from public.game_runs r where r.id = run_id and r.user_id = auth.uid()));
create policy "own answers" on public.daily_answers for select to authenticated using (user_id = auth.uid());
create policy "own streak"  on public.streaks       for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- ============================================================================
--  Функции (RPC)
-- ============================================================================
-- Очки: 100 · (1 − |log10(догадка / истина)| / 2), от 0 до 100 — та же формула, что в js/compare.js, js/weight.js, js/daily.js
create function public.calc_score(p_guess double precision, p_truth double precision)
returns int language sql immutable as $$
  select greatest(0, least(100, round(100 * (1 - abs(ln(p_guess / p_truth) / ln(10)) / 2))))::int
$$;

-- Стрик (внутренняя функция: клиент вызвать её не может)
create function public.bump_streak(p_uid uuid, p_day date)
returns void language plpgsql security definer set search_path = public as $$
declare s public.streaks%rowtype; nxt int;
begin
  insert into public.streaks (user_id, current_streak, best_streak, last_played)
  values (p_uid, 1, 1, p_day) on conflict (user_id) do nothing;
  select * into s from public.streaks where user_id = p_uid for update;
  if s.last_played < p_day then
    nxt := case when s.last_played = p_day - 1 then s.current_streak + 1 else 1 end;
    update public.streaks set current_streak = nxt, best_streak = greatest(best_streak, nxt), last_played = p_day where user_id = p_uid;
  end if;
end $$;

-- Профиль создаётся при первом обращении с ником вида player_12345
create function public.ensure_profile()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare p public.profiles; n text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = auth.uid();
  if found then return p; end if;
  loop
    n := 'player_' || lpad((floor(random() * 100000))::int::text, 5, '0');
    begin
      insert into public.profiles (id, nickname) values (auth.uid(), n) returning * into p;
      return p;
    exception when unique_violation then
      select * into p from public.profiles where id = auth.uid();
      if found then return p; end if;
    end;
  end loop;
end $$;

-- Смена никнейма: 3–20 символов, буквы/цифры/_ . -, уникален без учёта регистра.
-- p_initial = true — выбор ника при первом входе (бесплатно, один раз); дальше менять можно не чаще 1 раза в 3 дня.
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

-- Ответ на вопрос дня. Клиент присылает день, номер вопроса, ответ и правильное значение из data/questions.json;
-- очки сервер считает сам. Повторный ответ за тот же день не перезаписывает первый.
create function public.submit_daily(p_day date, p_q int, p_guess double precision, p_truth double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date; sc int; old public.daily_answers;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_guess is null or p_guess <= 0 or p_guess > 1e300 or p_truth is null or p_truth <= 0 or p_truth > 1e300 then raise exception 'invalid_guess'; end if;
  if p_day is null or p_day > today or p_day < date '2026-01-01' or p_q is null or p_q < 0 or p_q > 100000 then raise exception 'invalid_day'; end if;
  perform public.ensure_profile();
  sc := public.calc_score(p_guess, p_truth);
  insert into public.daily_answers (user_id, day, q_idx, guess, truth, score) values (uid, p_day, p_q, p_guess, p_truth, sc) on conflict do nothing;
  if not found then
    select * into old from public.daily_answers where user_id = uid and day = p_day;
    return jsonb_build_object('score', old.score, 'truth', old.truth, 'guess', old.guess, 'already', true);
  end if;
  if p_day = today then perform public.bump_streak(uid, today); end if;
  return jsonb_build_object('score', sc, 'truth', p_truth, 'guess', p_guess, 'already', false);
end $$;

-- Забег из 5 раундов. p_rounds = [{"k":"earth>jupiter","g":11.2,"t":11.2}, …]
create function public.submit_run(p_mode text, p_rounds jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  r jsonb; g double precision; t double precision; k text; sc int; total int := 0; i int := 0; rid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_mode not in ('compare','weight') then raise exception 'invalid_mode'; end if;
  if jsonb_typeof(p_rounds) <> 'array' or jsonb_array_length(p_rounds) <> 5 then raise exception 'invalid_rounds'; end if;
  if (select count(*) from public.game_runs where user_id = uid and played_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;
  perform public.ensure_profile();
  insert into public.game_runs (user_id, mode, score, rounds) values (uid, p_mode, 0, 5) returning id into rid;
  for r in select value from jsonb_array_elements(p_rounds) loop
    k := left(r->>'k', 64); g := (r->>'g')::double precision; t := (r->>'t')::double precision;
    if k is null or g is null or t is null or g <= 0 or t <= 0 or g > 1e300 or t > 1e300 then raise exception 'invalid_round'; end if;
    sc := public.calc_score(g, t); total := total + sc;
    insert into public.run_rounds (run_id, idx, key, guess, truth, score) values (rid, i, k, g, t, sc);
    i := i + 1;
  end loop;
  update public.game_runs set score = total where id = rid;
  perform public.bump_streak(uid, today);
  return jsonb_build_object('run_id', rid, 'score', total);
end $$;

-- Вся личная статистика одним запросом
create function public.get_my_stats()
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

-- ============================================================================
--  Права на функции: только вошедшие (анонимные сессии тоже «authenticated»)
-- ============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on function public.ensure_profile()                                          to authenticated;
grant  execute on function public.set_nickname(text, boolean)                               to authenticated;
grant  execute on function public.submit_daily(date, int, double precision, double precision) to authenticated;
grant  execute on function public.submit_run(text, jsonb)                                   to authenticated;
grant  execute on function public.get_my_stats()                                            to authenticated;

-- ============================================================================
--  Лидерборды (view отдаёт только ник и агрегаты — для будущей страницы Leaderboards)
-- ============================================================================
create view public.leaderboard_compare as
  select p.nickname, max(r.score) as best, count(*) as runs from public.game_runs r join public.profiles p on p.id = r.user_id
   where r.mode = 'compare' group by p.id, p.nickname order by best desc, runs asc limit 100;
create view public.leaderboard_weight as
  select p.nickname, max(r.score) as best, count(*) as runs from public.game_runs r join public.profiles p on p.id = r.user_id
   where r.mode = 'weight' group by p.id, p.nickname order by best desc, runs asc limit 100;
create view public.leaderboard_daily_today as
  select p.nickname, a.score from public.daily_answers a join public.profiles p on p.id = a.user_id
   where a.day = (now() at time zone 'utc')::date order by a.score desc, a.answered_at asc limit 100;
create view public.leaderboard_daily_total as
  select p.nickname, sum(a.score)::int as total, count(*)::int as answered from public.daily_answers a join public.profiles p on p.id = a.user_id
   group by p.id, p.nickname order by total desc, answered asc limit 100;
grant select on public.leaderboard_compare, public.leaderboard_weight, public.leaderboard_daily_today, public.leaderboard_daily_total to anon, authenticated;
