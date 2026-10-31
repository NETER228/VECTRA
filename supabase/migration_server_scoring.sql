-- Apply after migration_server_answers.sql. Keep the RPC signatures so existing clients work.
-- Client-supplied truth is ignored; answer data is resolved from server tables.
create or replace function public.submit_daily(p_day date, p_q int, p_guess double precision, p_truth double precision)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  expected_idx int; truth_value double precision; sc int; old public.daily_answers;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_day is null or p_day > today or p_day < date '2026-08-15' then raise exception 'invalid_day'; end if;
  if p_guess is null or p_guess <= 0 or p_guess > 1e300 then raise exception 'invalid_guess'; end if;
  select mod(mod(((p_day - date '2026-08-15') * 55), count(*)::int) + count(*)::int, count(*)::int)
    into expected_idx from public.vectra_questions;
  if p_q is distinct from expected_idx then raise exception 'invalid_question'; end if;
  select answer into truth_value from public.vectra_questions where idx = expected_idx;
  if truth_value is null then raise exception 'missing_question'; end if;
  perform public.ensure_profile();
  sc := public.calc_score(p_guess, truth_value);
  insert into public.daily_answers(user_id, day, q_idx, guess, truth, score)
    values(uid, p_day, expected_idx, p_guess, truth_value, sc) on conflict do nothing;
  if not found then
    select * into old from public.daily_answers where user_id = uid and day = p_day;
    return jsonb_build_object('score', old.score, 'truth', old.truth, 'guess', old.guess, 'already', true);
  end if;
  if p_day = today then perform public.bump_streak(uid, today); end if;
  return jsonb_build_object('score', sc, 'truth', truth_value, 'guess', p_guess, 'already', false);
end $$;

create or replace function public.submit_run(p_mode text, p_rounds jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'utc')::date;
  r jsonb; guess_value double precision; truth_value double precision;
  round_key text; parts text[]; sc int; total int := 0; i int := 0; rid bigint;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_mode not in ('compare', 'weight') then raise exception 'invalid_mode'; end if;
  if jsonb_typeof(p_rounds) is distinct from 'array' or jsonb_array_length(p_rounds) <> 5 then raise exception 'invalid_rounds'; end if;
  if (select count(*) from public.game_runs where user_id = uid and played_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;
  perform public.ensure_profile();
  insert into public.game_runs(user_id, mode, score, rounds) values(uid, p_mode, 0, 5) returning id into rid;
  for r in select value from jsonb_array_elements(p_rounds) loop
    round_key := r->>'k';
    if round_key is null or length(round_key) > 64 then raise exception 'invalid_round'; end if;
    guess_value := (r->>'g')::double precision;
    if guess_value is null or guess_value <= 0 or guess_value > 1e300 then raise exception 'invalid_round'; end if;
    if p_mode = 'weight' then
      select mass_kg into truth_value from public.vectra_objects where id = round_key;
    else
      parts := string_to_array(round_key, '>');
      if array_length(parts, 1) <> 2 then raise exception 'invalid_round'; end if;
      select b.size_m / a.size_m into truth_value
        from public.vectra_objects a cross join public.vectra_objects b
        where a.id = parts[1] and b.id = parts[2] and a.size_m > 0 and b.size_m > 0 and a.id <> b.id;
    end if;
    if truth_value is null then raise exception 'unknown_object'; end if;
    sc := public.calc_score(guess_value, truth_value); total := total + sc;
    insert into public.run_rounds(run_id, idx, key, guess, truth, score)
      values(rid, i, round_key, guess_value, truth_value, sc);
    i := i + 1;
  end loop;
  update public.game_runs set score = total where id = rid;
  perform public.bump_streak(uid, today);
  return jsonb_build_object('run_id', rid, 'score', total);
end $$;

revoke execute on function public.submit_daily(date, int, double precision, double precision) from public, anon;
revoke execute on function public.submit_run(text, jsonb) from public, anon;
grant execute on function public.submit_daily(date, int, double precision, double precision) to authenticated;
grant execute on function public.submit_run(text, jsonb) to authenticated;
