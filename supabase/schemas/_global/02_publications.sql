do $$ begin alter publication supabase_realtime add table public.bets; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.predictions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.room_members; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.rooms; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.room_stats; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.player_room_stats; exception when duplicate_object then null; end $$;
