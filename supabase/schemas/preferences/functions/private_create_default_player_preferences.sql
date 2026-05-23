create or replace function private.create_default_player_preferences()
returns trigger
language plpgsql
as $$
begin
  insert into public.player_preferences (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;
