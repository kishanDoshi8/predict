-- Stops pushes to this browser for the signed-in player, e.g. on sign-out.
create or replace function public.delete_my_push_subscription(
  p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_user_id uuid;
begin
  v_user_id := private.get_player_id_from_auth();

  if v_user_id is null then
    return;
  end if;

  delete from public.user_push_subscriptions
  where user_id = v_user_id
    and subscription->>'endpoint' = p_endpoint;
end;
$$;
