drop trigger if exists trg_players_create_default_preferences on public.players;
create trigger trg_players_create_default_preferences
after insert on public.players
for each row execute function private.create_default_player_preferences();
