drop trigger if exists trg_room_preferences_touch_updated_at on public.room_preferences;
create trigger trg_room_preferences_touch_updated_at
before update on public.room_preferences
for each row execute function private.touch_updated_at();
