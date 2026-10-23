-- Used by RLS policies on duel_queue.
create or replace function private.can_view_duel(p_duel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.duels d
    where d.id = p_duel_id
      and private.can_view_prediction(d.prediction_id)
  );
$$;
