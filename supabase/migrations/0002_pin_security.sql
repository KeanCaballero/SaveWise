-- ============================================================
-- SaveWise — Migration 0002: server-side PIN security
-- Run once in the Supabase SQL Editor (after schema.sql).
-- Idempotent: safe to re-run.
--
-- What this does, and WHY:
--   V1 verified PINs in the browser by comparing an unsalted
--   SHA-256 hash that was shipped to the client. A 4–6 digit PIN
--   has at most 10^6 values, so that hash is reversible in
--   milliseconds, and any "3 attempts" limit living in React can
--   be bypassed by calling the REST API directly.
--
--   This migration moves ALL PIN logic into the database:
--     • PINs are hashed with bcrypt (pgcrypto crypt + gen_salt).
--     • Verification, attempt-counting and the 15-min lockout run
--       inside SECURITY DEFINER functions — they can't be skipped.
--     • The pin_hash + lockout columns are revoked from the anon
--       role, so they never reach the browser at all.
--
--   Legacy SHA-256 hashes still verify (and are transparently
--   upgraded to bcrypt on the next successful unlock), so existing
--   profiles — including the demo profile (PIN 1234) — keep working.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Lockout state columns
-- ------------------------------------------------------------
alter table profiles add column if not exists failed_attempts int not null default 0;
alter table profiles add column if not exists locked_until    timestamptz;

-- ------------------------------------------------------------
-- 2. verify_profile_pin — the only way to check a PIN.
--    Returns: {status: 'ok' | 'wrong' | 'locked' | 'not_found',
--              attempts_remaining?, locked_until?, seconds_remaining?}
--    search_path includes `extensions` because Supabase installs
--    pgcrypto (crypt/gen_salt/digest) there, not in public.
-- ------------------------------------------------------------
create or replace function public.verify_profile_pin(p_profile_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile      profiles%rowtype;
  v_matched      boolean;
  v_is_legacy    boolean;
  v_max_attempts constant int := 3;
  v_lock_minutes constant int := 15;
begin
  select * into v_profile from profiles where id = p_profile_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Already locked? Report remaining time without consuming an attempt.
  if v_profile.locked_until is not null and v_profile.locked_until > now() then
    return jsonb_build_object(
      'status', 'locked',
      'locked_until', v_profile.locked_until,
      'seconds_remaining', ceil(extract(epoch from (v_profile.locked_until - now())))
    );
  end if;

  -- bcrypt hashes start with '$'; anything else is a legacy SHA-256 hash.
  v_is_legacy := left(v_profile.pin_hash, 1) <> '$';
  if v_is_legacy then
    v_matched := v_profile.pin_hash = encode(digest('savewise::' || p_pin, 'sha256'), 'hex');
  else
    v_matched := v_profile.pin_hash = crypt(p_pin, v_profile.pin_hash);
  end if;

  if v_matched then
    update profiles
       set failed_attempts = 0,
           locked_until    = null,
           last_active_at  = now(),
           -- lazily upgrade legacy hashes to bcrypt once we know the plaintext
           pin_hash = case when v_is_legacy then crypt(p_pin, gen_salt('bf', 10)) else pin_hash end
     where id = p_profile_id;
    return jsonb_build_object('status', 'ok');
  end if;

  -- Wrong PIN: would this be the 3rd strike?
  if v_profile.failed_attempts + 1 >= v_max_attempts then
    update profiles
       set failed_attempts = 0,                               -- reset for the next window
           locked_until    = now() + make_interval(mins => v_lock_minutes)
     where id = p_profile_id;
    return jsonb_build_object(
      'status', 'locked',
      'locked_until', now() + make_interval(mins => v_lock_minutes),
      'seconds_remaining', v_lock_minutes * 60
    );
  end if;

  update profiles set failed_attempts = failed_attempts + 1 where id = p_profile_id;
  return jsonb_build_object(
    'status', 'wrong',
    'attempts_remaining', v_max_attempts - (v_profile.failed_attempts + 1)
  );
end;
$$;

-- ------------------------------------------------------------
-- 3. create_profile — inserts the profile + its settings row,
--    hashing the PIN server-side. Returns safe columns only.
-- ------------------------------------------------------------
create or replace function public.create_profile(
  p_name                 text,
  p_pin                  text,
  p_avatar               text    default '🦊',
  p_avatar_color         text    default 'emerald',
  p_monthly_income_goal  numeric default null,
  p_monthly_savings_goal numeric default null,
  p_is_demo              boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row profiles%rowtype;
begin
  if p_pin !~ '^\d{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits' using errcode = '22023';
  end if;

  insert into profiles (name, pin_hash, avatar, avatar_color, monthly_income_goal, monthly_savings_goal, is_demo)
  values (p_name, crypt(p_pin, gen_salt('bf', 10)), p_avatar, p_avatar_color, p_monthly_income_goal, p_monthly_savings_goal, p_is_demo)
  returning * into v_row;

  insert into settings (profile_id) values (v_row.id) on conflict (profile_id) do nothing;

  return jsonb_build_object(
    'id', v_row.id, 'name', v_row.name, 'avatar', v_row.avatar, 'avatar_color', v_row.avatar_color,
    'monthly_income_goal', v_row.monthly_income_goal, 'monthly_savings_goal', v_row.monthly_savings_goal,
    'is_demo', v_row.is_demo, 'last_active_at', v_row.last_active_at, 'created_at', v_row.created_at
  );
end;
$$;

-- ------------------------------------------------------------
-- 4. change_profile_pin — requires the current PIN. Returns
--    {status: 'ok' | 'wrong' | 'not_found'}.
-- ------------------------------------------------------------
create or replace function public.change_profile_pin(p_profile_id uuid, p_current_pin text, p_new_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile   profiles%rowtype;
  v_matched   boolean;
  v_is_legacy boolean;
begin
  if p_new_pin !~ '^\d{4,6}$' then
    raise exception 'PIN must be 4 to 6 digits' using errcode = '22023';
  end if;

  select * into v_profile from profiles where id = p_profile_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_is_legacy := left(v_profile.pin_hash, 1) <> '$';
  if v_is_legacy then
    v_matched := v_profile.pin_hash = encode(digest('savewise::' || p_current_pin, 'sha256'), 'hex');
  else
    v_matched := v_profile.pin_hash = crypt(p_current_pin, v_profile.pin_hash);
  end if;

  if not v_matched then
    return jsonb_build_object('status', 'wrong');
  end if;

  update profiles
     set pin_hash = crypt(p_new_pin, gen_salt('bf', 10)),
         failed_attempts = 0,
         locked_until = null
   where id = p_profile_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

-- ------------------------------------------------------------
-- 5. Lock down the profiles table.
--    The client may read safe columns and edit cosmetic fields,
--    but pin_hash / failed_attempts / locked_until are touched
--    ONLY by the functions above. Inserts go through create_profile.
-- ------------------------------------------------------------
revoke all on profiles from anon, authenticated;
grant select (id, name, avatar, avatar_color, monthly_income_goal, monthly_savings_goal, is_demo, last_active_at, created_at)
  on profiles to anon, authenticated;
grant update (name, avatar, avatar_color, monthly_income_goal, monthly_savings_goal, last_active_at)
  on profiles to anon, authenticated;
grant delete on profiles to anon, authenticated;

grant execute on function public.create_profile(text, text, text, text, numeric, numeric, boolean) to anon, authenticated;
grant execute on function public.verify_profile_pin(uuid, text)        to anon, authenticated;
grant execute on function public.change_profile_pin(uuid, text, text)   to anon, authenticated;

-- ============================================================
-- FUTURE — migrating to Supabase Auth (Path B), for reference.
-- No table reshape required; it's an additive column + policy swap:
--
--   alter table profiles add column owner_id uuid references auth.users(id);
--   -- backfill owner_id for existing rows, then:
--   alter table profiles alter column owner_id set not null;
--
--   -- replace the permissive policy on every table, e.g. transactions:
--   drop policy savewise_open_access on transactions;
--   create policy owner_rows on transactions for all
--     using (profile_id in (select id from profiles where owner_id = auth.uid()))
--     with check (profile_id in (select id from profiles where owner_id = auth.uid()));
--
-- Everything is already keyed by profile_id, so only the policies change.
-- ============================================================
