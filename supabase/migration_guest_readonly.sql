-- Guest demo: public leaderboard, no browser-created accounts or score writes.
-- get_leaderboard returns only nickname and aggregate scores.
grant execute on function public.get_leaderboard(text) to anon;
revoke execute on function public.ensure_profile() from authenticated;
revoke execute on function public.set_nickname(text, boolean) from authenticated;
revoke execute on function public.submit_daily(date, int, double precision, double precision) from authenticated;
revoke execute on function public.submit_run(text, jsonb) from authenticated;
revoke execute on function public.set_prefs(text, text) from authenticated;
revoke execute on function public.accept_terms(int) from authenticated;
revoke execute on function public.set_verified(boolean) from authenticated;
