-- Stream new activity rows to the feed and the header bell.
-- The room_activities_select policy already limits rows to room members.
do $$ begin alter publication supabase_realtime add table public.room_activities; exception when duplicate_object then null; end $$;
