-- ============================================================
-- Migration: 007_generate_token_using_extention
-- Description: Generate player_token and organizer_token using pgcrypto extension for secure random tokens.
--
-- ============================================================

-- ============================================================
-- HELPER: generate a secure random 32-char hex token
-- ============================================================
drop function if exists private.generate_token();

create function private.generate_token()
returns text
language sql
as $$
  select encode(extensions.gen_random_bytes(16), 'hex');
$$;

-- ============================================================
-- HARDEN REMAINING PUBLIC RPCs WITH search_path
-- ============================================================
alter function public.resolve_prediction(text, uuid, text, uuid)
  set search_path = public, private;

alter function private.refund_all_bets(uuid)
  set search_path = public, private;

alter function private.generate_room_code()
  set search_path = public, private;

alter function private.generate_token()
  set search_path = public, private;

alter function private.current_week_key()
  set search_path = public, private;

-- ============================================================
-- CRON: Auto-lock predictions past their deadline
-- Requires pg_cron (enable in Supabase Dashboard > Extensions)
-- Run this once manually after enabling pg_cron:
-- ============================================================


select cron.schedule(
'auto-lock-predictions',
'* * * * *',
$$
    update public.predictions
    set status = 'locked'
    where status = 'draft'
    and deadline <= now();
$$
);