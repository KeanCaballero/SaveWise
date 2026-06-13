-- ============================================================
-- SaveWise — Supabase schema (v1)
-- Run this once in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles — the root of all data ownership.
-- PINs are stored as SHA-256 hashes (device-trust protection,
-- not authentication; see README security notes).
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
