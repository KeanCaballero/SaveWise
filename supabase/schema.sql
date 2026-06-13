-- ============================================================
-- SaveWise — Supabase schema (v1)
-- Run this once in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles — the root of all data ownership.
-- PINs are bcrypt-hashed and verified entirely server-side via the
-- functions at the bottom of this file; the hash + lockout columns
-- are never exposed to the client (see grants + README security notes).
-- ------------------------------------------------------------
create table if not exists profiles (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(name) between 1 and 30),
  pin_hash             text not null,
  avatar               text not null default '🦊',
  avatar_color         text not null default 'emerald',
  monthly_income_goal  numeric(14,2) check (monthly_income_goal is null or monthly_income_goal > 0),
  monthly_savings_goal numeric(14,2) check (monthly_savings_goal is null or monthly_savings_goal > 0),
  is_demo              boolean not null default false,
  failed_attempts      int not null default 0,
  locked_until         timestamptz,
  last_active_at       timestamptz,
  created_at           timestamptz not null default now()
);

-- ------------------------------------------------------------
-- transactions — income & expenses
-- ------------------------------------------------------------
create table if not exists transactions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type       text not null check (type in ('income', 'expense')),
  amount     numeric(14,2) not null check (amount > 0),
  category   text not null,
  date       date not null default current_date,
  notes      text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_profile_date on transactions (profile_id, date desc);
create index if not exists idx_transactions_profile_type on transactions (profile_id, type);
create index if not exists idx_transactions_profile_category on transactions (profile_id, category);

-- ------------------------------------------------------------
-- budgets — monthly limit per expense category
-- month is always the first day of the month ('YYYY-MM-01')
-- ------------------------------------------------------------
create table if not exists budgets (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  category   text not null,
  amount     numeric(14,2) not null check (amount > 0),
  month      date not null,
  created_at timestamptz not null default now(),
  unique (profile_id, category, month)
);
create index if not exists idx_budgets_profile_month on budgets (profile_id, month);

-- ------------------------------------------------------------
-- savings_goals
-- ------------------------------------------------------------
create table if not exists savings_goals (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  target_amount  numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date    date,
  priority       text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_goals_profile on savings_goals (profile_id);

-- ------------------------------------------------------------
-- loans — debts (you owe) and receivables (owed to you)
-- ------------------------------------------------------------
create table if not exists loans (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('debt', 'receivable')),
  person_name text not null check (char_length(person_name) between 1 and 60),
  amount      numeric(14,2) not null check (amount > 0),
  due_date    date,
  status      text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  notes       text check (notes is null or char_length(notes) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists idx_loans_profile_status on loans (profile_id, status);
create index if not exists idx_loans_profile_due on loans (profile_id, due_date);

-- ------------------------------------------------------------
-- bills
-- ------------------------------------------------------------
create table if not exists bills (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  amount     numeric(14,2) not null check (amount > 0),
  due_date   date not null,
  status     text not null default 'unpaid' check (status in ('paid', 'unpaid', 'overdue')),
  created_at timestamptz not null default now()
);
create index if not exists idx_bills_profile_due on bills (profile_id, due_date);
create index if not exists idx_bills_profile_status on bills (profile_id, status);

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  cost          numeric(14,2) not null check (cost > 0),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('weekly', 'monthly', 'yearly')),
  renewal_date  date not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_subscriptions_profile_renewal on subscriptions (profile_id, renewal_date);

-- ------------------------------------------------------------
-- family vaults + contributions (shared savings goals)
-- profile_id on contributions mirrors the owning profile so all
-- of a profile's data can be queried/deleted uniformly.
-- ------------------------------------------------------------
create table if not exists family_vaults (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14,2) not null check (target_amount > 0),
  created_at    timestamptz not null default now()
);
create index if not exists idx_vaults_profile on family_vaults (profile_id);

create table if not exists family_contributions (
  id               uuid primary key default gen_random_uuid(),
  vault_id         uuid not null references family_vaults(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  contributor_name text not null check (char_length(contributor_name) between 1 and 40),
  amount           numeric(14,2) not null check (amount > 0),
  date             date not null default current_date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_contributions_vault on family_contributions (vault_id);
create index if not exists idx_contributions_profile on family_contributions (profile_id);

-- ------------------------------------------------------------
-- achievements catalog + per-profile unlocks
-- ------------------------------------------------------------
create table if not exists achievements (
  id          text primary key,
  title       text not null,
  description text not null,
  icon        text not null,
  sort_order  int not null default 0
);

insert into achievements (id, title, description, icon, sort_order) values
  ('first_transaction', 'First Steps',   'Log your first transaction',                       '📝', 1),
  ('saved_1k',          'Saver',         'Reach 1,000 in total savings',                     '💰', 2),
  ('saved_10k',         'Super Saver',   'Reach 10,000 in total savings',                    '🏦', 3),
  ('first_goal',        'Goal Getter',   'Complete your first savings goal',                 '🎯', 4),
  ('streak_30',         'On Fire',       'Track transactions 30 days in a row',              '🔥', 5),
  ('debt_free',         'Debt-Free',     'Pay off every debt you owe',                       '🕊️', 6),
  ('budget_master',     'Budget Master', 'Finish a month with every budget under its limit', '👑', 7)
on conflict (id) do nothing;

create table if not exists profile_achievements (
  profile_id     uuid not null references profiles(id) on delete cascade,
  achievement_id text not null references achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (profile_id, achievement_id)
);

-- ------------------------------------------------------------
-- notifications — dedupe_key keeps engine scans idempotent
-- ------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type       text not null default 'system',
  title      text not null,
  message    text not null,
  dedupe_key text not null,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, dedupe_key)
);
create index if not exists idx_notifications_profile_read on notifications (profile_id, read, created_at desc);

-- ------------------------------------------------------------
-- settings — one row per profile
-- ------------------------------------------------------------
create table if not exists settings (
  profile_id            uuid primary key references profiles(id) on delete cascade,
  currency              text not null default 'PHP',
  theme                 text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notifications_enabled boolean not null default true,
  updated_at            timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security
-- V1 ships without server-side auth (profiles + PINs are a
-- device-trust model). RLS is enabled with permissive policies
-- so flipping to Supabase Auth later only means rewriting the
-- policies — table shape stays the same.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'transactions', 'budgets', 'savings_goals', 'loans', 'bills',
    'subscriptions', 'family_vaults', 'family_contributions', 'achievements',
    'profile_achievements', 'notifications', 'settings'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists savewise_open_access on %I', t);
    execute format('create policy savewise_open_access on %I for all using (true) with check (true)', t);
  end loop;
end
$$;

-- ============================================================
-- Server-side PIN security (see supabase/migrations/0002_pin_security.sql
-- for the full rationale). PINs are bcrypt-hashed and all verification,
-- attempt-counting and the 15-minute lockout happen inside these
-- SECURITY DEFINER functions — never in the client. Legacy SHA-256
-- hashes still verify and are upgraded to bcrypt on first unlock.
-- ============================================================

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

  if v_profile.locked_until is not null and v_profile.locked_until > now() then
    return jsonb_build_object(
      'status', 'locked',
      'locked_until', v_profile.locked_until,
      'seconds_remaining', ceil(extract(epoch from (v_profile.locked_until - now())))
    );
  end if;

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
           pin_hash = case when v_is_legacy then crypt(p_pin, gen_salt('bf', 10)) else pin_hash end
     where id = p_profile_id;
    return jsonb_build_object('status', 'ok');
  end if;

  if v_profile.failed_attempts + 1 >= v_max_attempts then
    update profiles
       set failed_attempts = 0,
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

revoke all on profiles from anon, authenticated;
grant select (id, name, avatar, avatar_color, monthly_income_goal, monthly_savings_goal, is_demo, last_active_at, created_at)
  on profiles to anon, authenticated;
grant update (name, avatar, avatar_color, monthly_income_goal, monthly_savings_goal, last_active_at)
  on profiles to anon, authenticated;
grant delete on profiles to anon, authenticated;

grant execute on function public.create_profile(text, text, text, text, numeric, numeric, boolean) to anon, authenticated;
grant execute on function public.verify_profile_pin(uuid, text)        to anon, authenticated;
grant execute on function public.change_profile_pin(uuid, text, text)   to anon, authenticated;
