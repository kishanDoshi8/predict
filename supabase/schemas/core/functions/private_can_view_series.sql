-- Used by RLS policies on series results tables.
create or replace function private.can_view_series(p_series_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.series s
    where s.id = p_series_id
      and private.is_room_member(s.room_id)
  );
$$;
