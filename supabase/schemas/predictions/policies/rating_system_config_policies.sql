alter table public.rating_system_config enable row level security;
revoke all on public.rating_system_config from anon;
revoke all on public.rating_system_config from authenticated;
drop policy if exists "rating_system_config_select_authenticated" on public.rating_system_config;
create policy "rating_system_config_select_authenticated"
  on public.rating_system_config
  for select
  to authenticated
  using (true);
grant select on public.rating_system_config to authenticated;
