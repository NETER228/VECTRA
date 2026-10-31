-- Enable password-authenticated account profiles and score writes for logged-in players only.
-- Guests remain read-only; table access remains protected by RLS.
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.set_nickname(text, boolean) to authenticated;
grant execute on function public.submit_daily(date, int, double precision, double precision) to authenticated;
grant execute on function public.submit_run(text, jsonb) to authenticated;
grant execute on function public.get_my_stats() to authenticated;
grant execute on function public.get_me() to authenticated;
grant execute on function public.set_prefs(text, text) to authenticated;
grant execute on function public.accept_terms(int) to authenticated;
grant execute on function public.set_verified(boolean) to authenticated;
grant execute on function public.get_daily(date) to authenticated;
