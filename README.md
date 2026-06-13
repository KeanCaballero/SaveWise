# SaveWise

**Track. Save. Grow.**

A modern personal-finance platform: track income & expenses, plan budgets, fund savings goals, manage loans, bills and subscriptions, share family vaults — with a financial health score, smart insights, achievements, and a notification center.

Built with **React + Vite + Tailwind CSS + shadcn/ui + Recharts + React Hook Form + Zod** on a **Supabase (PostgreSQL)** backend. Deploys to **Vercel**.

---

## Quick start

```bash
npm install
npm run dev
```

With no Supabase credentials configured, the app shows a guided setup screen — including a **Demo Mode** button that runs the entire app in your browser (localStorage) with one-click sample data, so you can preview everything before touching a database.

## Supabase setup (one time)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates all 13 tables (profiles, transactions, budgets, savings_goals, loans, bills, subscriptions, family_vaults, family_contributions, achievements, profile_achievements, notifications, settings) with foreign keys, check constraints, indexes, the achievements catalog, and RLS policies. The script is idempotent — safe to re-run.
3. Copy **Project Settings → API**: Project URL + `anon` public key.
4. Create `.env` in the project root (see `.env.example`):

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

5. Restart `npm run dev`. Create your first profile and you're in.

## Deploying to Vercel

1. Push the project to GitHub (`git init && git add -A && git commit -m "SaveWise v1"`).
2. In [vercel.com](https://vercel.com) → **Add New Project** → import the repo. Vercel auto-detects Vite (`npm run build`, output `dist/`).
3. Under **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. `vercel.json` already rewrites all routes to `index.html` so React Router deep links work.

## Profiles, PINs & security model (read this)

Version 1 has **no full authentication** — it uses a Netflix-style profile system. Each profile has a 4–6 digit PIN with these protections:

- **PINs are bcrypt-hashed and verified entirely server-side.** Verification, the 3-attempt limit, and the 15-minute lockout all live inside Postgres `SECURITY DEFINER` functions (`verify_profile_pin`, `create_profile`, `change_profile_pin`). The lockout can't be bypassed by calling the REST API directly or skipping the UI.
- **The PIN hash never reaches the browser.** Column grants revoke `pin_hash`, `failed_attempts` and `locked_until` from the `anon` role, so the client can only read safe profile columns.
- **Sessions persist across reloads but auto-lock after 15 minutes of inactivity**, requiring the PIN again.
- Legacy SHA-256 hashes from earlier builds still verify and are transparently upgraded to bcrypt on the next unlock — so existing profiles (and the demo PIN `1234`) keep working after you run the migration.

**Run the migration:** after `schema.sql`, run [`supabase/migrations/0002_pin_security.sql`](supabase/migrations/0002_pin_security.sql) once in the SQL Editor (it's idempotent). Fresh installs of `schema.sql` already include everything.

This is still a **device-trust model**, not multi-tenant isolation: anyone holding your `anon` key can read other profiles' *financial rows* (transactions, budgets, …), because RLS is permissive. That's fine for personal/family use on your own Supabase project; **don't** host strangers' data on it. The upgrade path is Supabase Auth + per-user RLS — and because every table is already keyed by `profile_id`, it's an additive `owner_id` column + a policy swap (sketched at the bottom of the migration file), **not** a rewrite.

## Sample data

On first launch you'll be offered **"Start with sample data"** — it creates a `Demo` profile (PIN `1234`) with ~3 months of transactions, budgets, goals, loans, bills, subscriptions and a family vault. Remove it any time with one click (trash icon on the profile card, or Profile → Danger zone); deletion cascades through every table.

## Architecture

```
src/
├── App.jsx                  # Router + route guards (setup → profiles → app)
├── components/
│   ├── ui/                  # shadcn/ui primitives (JSX)
│   ├── layout/              # AppShell (sidebar + bottom nav), header, bell
│   ├── shared/              # StatCard, EmptyState, ProgressRing, PinInput…
│   └── charts/              # Recharts wrappers (pie, bars, line, area)
├── context/                 # ProfileContext (unlock/lock), ThemeContext
├── hooks/                   # useAsyncData
├── lib/
│   ├── health.js            # Financial Health Score (0–100, 4 weighted parts)
│   ├── insights.js          # Smart Insights rules engine
│   ├── achievements.js      # Achievement catalog + unlock engine
│   ├── notify.js            # Notification scanner (due dates, milestones)
│   ├── reportData.js        # Weekly/monthly/yearly chart bucketing
│   └── seed.js              # Demo data seeder
├── pages/                   # One page per module + profile gate
└── services/
    ├── db.js                # Data adapter: Supabase ⇄ localStorage demo mode
    └── *.js                 # Domain services (transactions, budgets, …)
```

**Business logic**

- **Financial Health Score** — savings rate (30 pts), debt ratio vs a 3-month income buffer (25), budget adherence (25), goal completion (20). Color-coded ring + per-part breakdown on the dashboard.
- **Smart Insights** — rule-based: category spending shifts vs last month, budgets near/over limit, goal pacing ("save ₱X more weekly to hit your target date"), savings-rate trend, subscription load, top spending category.
- **Achievement engine** — evaluates unlock conditions after data changes and on dashboard load; idempotent upserts; unlocks also create notifications.
- **Notification scanner** — runs on app load; flags loans due/overdue (and rolls status to `overdue`), bills due within 3 days, renewals within 3 days, goal milestones (25/50/75/100%), budgets ≥90% or exceeded. Dedupe keys make scans idempotent.

## Scripts

| Command           | Action                    |
| ----------------- | ------------------------- |
| `npm run dev`     | Dev server with HMR       |
| `npm run build`   | Production build → `dist` |
| `npm run preview` | Preview the build locally |

## Roadmap ideas (v2)

Supabase Auth + strict RLS, recurring bills, CSV export, budget rollovers, multi-device family vaults with invitations, push notifications, PWA offline mode.
