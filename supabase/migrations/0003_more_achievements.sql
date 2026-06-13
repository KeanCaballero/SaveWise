-- ============================================================
-- SaveWise — Migration 0003: more achievements
-- Run once in the Supabase SQL Editor. Idempotent.
--
-- Adds 8 new badges to the catalog. profile_achievements has a
-- foreign key to achievements(id), so these rows must exist before
-- the app can unlock them.
-- ============================================================

insert into achievements (id, title, description, icon, sort_order) values
  ('income_logged', 'Payday',       'Log your first income',              '💵', 8),
  ('streak_7',      'Week Warrior', 'Track transactions 7 days in a row', '🗓️', 9),
  ('txn_100',       'Century',      'Log 100 transactions',               '💯', 10),
  ('saved_50k',     'Treasurer',    'Reach 50,000 in total savings',      '💎', 11),
  ('goal_3',        'Triple Crown', 'Complete 3 savings goals',           '🏆', 12),
  ('lender',        'Good Friend',  'Record money you lent out',          '🤝', 13),
  ('bill_paid',     'Paid Up',      'Mark a bill as paid',                '🧾', 14),
  ('subs_3',        'Subscribed',   'Track 3 subscriptions',              '📺', 15)
on conflict (id) do nothing;
