drop trigger if exists trg_player_preferences_touch_updated_at on public.player_preferences;
create trigger trg_player_preferences_touch_updated_at
before update on public.player_preferences
for each row execute function private.touch_updated_at();
