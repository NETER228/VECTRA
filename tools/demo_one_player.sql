-- One-time demo reset for the current Supabase project.
-- Permanently deletes every other anonymous auth user and all player results.
-- Keeps the existing ИЗИ_ГГ account and the question/object reference tables.
begin;

do $$
declare
  v_uid uuid;
  v_today date := (now() at time zone 'utc')::date;
  v_day date;
  v_q int;
  v_truth double precision;
  v_guess double precision;
  v_ratio double precision;
  v_mode text;
  v_run int;
  v_round int;
  v_run_id bigint;
  v_score int;
  v_total int;
  v_key text;
  v_a text;
  v_b text;
  v_size_a double precision;
  v_size_b double precision;
  v_object_count int;
  v_size_count int;
  v_question_count int;
begin
  select id into strict v_uid from public.profiles where nickname = 'ИЗИ_ГГ';
  if not exists (select 1 from auth.users where id = v_uid and is_anonymous) then
    raise exception 'target_must_be_anonymous';
  end if;
  select count(*) into v_question_count from public.vectra_questions;
  select count(*) into v_object_count from public.vectra_objects where mass_kg > 0;
  select count(*) into v_size_count from public.vectra_objects where size_m > 0;
  if v_question_count <> 144 or v_object_count < 20 or v_size_count < 20 then
    raise exception 'reference_data_not_ready';
  end if;

  -- Foreign keys cascade through profiles, answers, runs, rounds and streaks.
  delete from auth.users where id <> v_uid;
  delete from public.game_runs where user_id = v_uid;
  delete from public.daily_answers where user_id = v_uid;
  delete from public.streaks where user_id = v_uid;
  update public.profiles
     set nickname = 'ИЗИ_ГГ', nickname_set = true,
         terms_version = greatest(terms_version, 1), terms_at = now(),
         verified_until = now() + interval '12 hours',
         prefs = jsonb_build_object('theme', 'dark', 'lang', 'ru'),
         updated_at = now()
   where id = v_uid;
  -- Disable reuse of the preserved anonymous account from its old browser.
  delete from auth.sessions where user_id = v_uid;
  update auth.users set banned_until = now() + interval '100 years' where id = v_uid;

  -- Every date visible in Daily Archive, from launch through today (UTC).
  for v_day in select generate_series(date '2026-08-15', v_today, interval '1 day')::date loop
    v_q := mod((v_day - date '2026-08-15') * 55, v_question_count);
    select answer into strict v_truth from public.vectra_questions where idx = v_q;
    v_ratio := case mod(v_day - date '2026-08-15', 4)
      when 0 then 1.25 when 1 then 1.40 when 2 then 1.55 else 1.70 end;
    v_guess := v_truth * v_ratio;
    insert into public.daily_answers(user_id, day, q_idx, guess, truth, score, answered_at)
      values(v_uid, v_day, v_q, v_guess, v_truth,
             public.calc_score(v_guess, v_truth), v_day::timestamp + interval '15 hours');
  end loop;

  -- Eight completed five-round runs in each game mode. All values match the server catalog.
  foreach v_mode in array array['compare', 'weight'] loop
    for v_run in 1..8 loop
      v_total := 0;
      insert into public.game_runs(user_id, mode, score, rounds, played_at)
        values(v_uid, v_mode, 0, 5, (v_today - (8 - v_run))::timestamp + interval '18 hours')
        returning id into v_run_id;
      for v_round in 0..4 loop
        if v_mode = 'weight' then
          select id, mass_kg into strict v_key, v_truth
            from public.vectra_objects where mass_kg > 0 order by id
            offset mod(v_run * 5 + v_round, v_object_count) limit 1;
        else
          select id, size_m into strict v_a, v_size_a
            from public.vectra_objects where size_m > 0 order by id
            offset mod(v_run * 5 + v_round, v_size_count) limit 1;
          select id, size_m into strict v_b, v_size_b
            from public.vectra_objects where size_m > 0 order by id
            offset mod(v_run * 5 + v_round + 7, v_size_count) limit 1;
          v_key := v_a || '>' || v_b;
          v_truth := v_size_b / v_size_a;
        end if;
        v_ratio := case mod(v_run + v_round, 4)
          when 0 then 1.25 when 1 then 1.40 when 2 then 1.55 else 1.70 end;
        v_guess := v_truth * v_ratio;
        v_score := public.calc_score(v_guess, v_truth);
        v_total := v_total + v_score;
        insert into public.run_rounds(run_id, idx, key, guess, truth, score)
          values(v_run_id, v_round, v_key, v_guess, v_truth, v_score);
      end loop;
      update public.game_runs set score = v_total where id = v_run_id;
    end loop;
  end loop;

  insert into public.streaks(user_id, current_streak, best_streak, last_played)
    values(v_uid, v_today - date '2026-08-15' + 1,
           v_today - date '2026-08-15' + 1, v_today);
end $$;

commit;
