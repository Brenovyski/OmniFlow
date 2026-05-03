# OmniFlow — project guide for Claude Code

This file is the persistent working brief for Claude Code. The `README.md` is the public-facing project doc; CLAUDE.md is the internal one — what to build, how it should look, and how to make calls when the user is not in the loop.

## Project at a glance

OmniFlow is a solo-user personal finance web app. One person tracks expenses, earnings, and investments by hand and sees the whole picture in an admin-style dashboard. Single user, no multi-tenancy, no marketing surface. PWA-first; Capacitor is deferred to a later phase.

For the full stack, schema decisions, and architecture choices, read `README.md` first — those decisions are locked unless the user explicitly revisits them.

> flows in (earnings), flows out (expenses), flows around (investments).

## Implementation session protocol

Every new session that picks up a Roadmap step **must** follow this loop. The protocol exists because steps land across separate sessions (often hitting usage limits mid-step), and skipping any of these is how plan / code / status drift apart.

1. **Read `implementation_plan.md` first.** It is the canonical step detail; the Roadmap section below is just an index. Don't start coding from memory or from the CLAUDE.md summary alone.
2. **Read the `## Status` block below** to confirm where the previous session actually stopped — some steps land in chunks (e.g. 3a/3b), and the prior session may have left files half-staged.
3. **Implement the step** using the prescribed file paths, patterns, and reused helpers from the plan. If reality diverges (constraint discovered, scope change, ordering swap), edit `implementation_plan.md` in the same commit as the code change — never let plan and code drift.
4. **Apply pending migrations yourself.** If the step ships SQL, push it via `pnpm dlx supabase db push` (see *Database migrations* below). The user has standing authorization for this — don't wait.
5. **Local verify.** Both `pnpm typecheck` and `pnpm build` must go green before handing off. Fix everything red yourself; don't punt failures to the smoke test.
6. **Hand off to the user for smoke testing.** Start the dev server with `pnpm dev` and post a short numbered checklist of what to click through (one item per Verification line in the step's plan entry). **Wait for the user to confirm** before committing — don't commit unverified work.
7. **Update `CLAUDE.md`** — flip the Roadmap checkbox to `[x]` (or `[~]` for chunked landings), add a "Step N — done" bullet to the Status block, and update the "Next step" pointer to the following step.
8. **Update `implementation_plan.md`** if anything in the plan turned out wrong, ambiguous, or expanded during implementation. Better to amend the plan than to leave it lying.
9. **Commit and push** in one go — code + migrations + CLAUDE.md + plan edits as a single logical commit. No co-authored trailer (per user preference). Push to remote unless the user has said otherwise.

If at any point the user types something that contradicts this protocol (e.g. "skip the smoke test, just commit"), do what they say — but log the deviation in the commit message so future sessions can see it happened.

### Session-limit handoff

Claude Code shows a "Plan usage limits — Current session N% used / Resets in Xh Ym" indicator. Treat that meter as a hard deadline, not a suggestion.

- **At ~85% used**, stop starting new work. Finish the slice in flight, then prepare the handoff.
- **At ~95% used**, abort even mid-slice — leaving a half-finished commit is fine, leaving the *next session* without a written record of where you stopped is not.

Before the session dies, in this order:

1. **Update `## Status`** with a precise line for what just landed *and* what is still pending inside the current step. Be specific — name the files that are partially done, the migration that wasn't pushed, the smoke test that wasn't run. "Step 5 — palette done, FAB pending" is useful. "Step 5 — partial" is not.
2. **Flip the Roadmap checkbox to `[~]`** (chunked landing) for the active step, never `[x]` — `[x]` is only for fully verified, fully shipped slices.
3. **Update `implementation_plan.md`** if you discovered anything mid-step that future-you needs to know (a constraint, a dropped sub-task, a renamed file). Don't carry that knowledge in your head — the next session won't have it.
4. **Commit and push** the partial work + status + plan edits in one commit, with a message like `wip(step N): <slice that landed> — <what is pending next>`. The commit is the handoff; without it the next session restarts cold.
5. Tell the user in the final message what step + slice they should resume on, so they can paste that as the kick-off prompt next session.

The whole point: a session that runs out of budget should leave the repo in a state where the next session reads `## Status` + the latest commit and immediately knows where to pick up. Never end a session with uncommitted work and a stale status block.

## Brand identity

### Mascot — Volt 

OmniFlow's mascot is **Volt**, a stylized falcon/swift silhouette whose tail-feather doubles as a lightning bolt. Volt should read as **fast, focused, electric** — not cute, not cartoonish. The reference space is modern fintech (Robinhood, Linear, Vercel) executed with personality, not children's-app whimsy.

Volt has presence at the edges of the experience and stays out of dense data UI:

- **Appears in**: favicon / app icon (monochrome silhouette), login screen (oversized, above the form), empty states (Volt + one-liner + CTA), the 404 page, optionally a small loading-state animation.
- **Does not appear in**: the dashboard, transaction tables, charts, settings forms, or anywhere the user is doing real work.

The bird is a brand moment, not a UI element.

### Color system

Yellow is the brand color, but **yellow is an accent, not a background**. A yellow-flooded finance dashboard reads as a warning state, not a brand. Yellow earns its keep on CTAs, active states, the brand mark, and selective highlights — surfaces and chrome stay neutral.

The full palette below is the starting point; values become Tailwind / shadcn tokens during scaffolding. Once tokens exist, components reference tokens, never raw hex.

| Role | Light | Dark | Notes |
|------|-------|------|-------|
| Brand primary (Volt yellow) | `#FACC15` | `#FFE066` | CTAs, active nav, brand mark |
| Brand pressed/hover | `#CA8A04` | `#EAB308` | Hover and pressed states for primary |
| App background | `#FAFAF9` | `#0B0F14` | Warm off-white / blue-tinted near-black |
| Surface (cards, sidebar) | `#FFFFFF` | `#141A21` | Sits on the background |
| Border | `#E7E5E4` | `#1F2832` | Hairline, never heavy |
| Text primary | `#0C0A09` | `#F5F5F4` | |
| Text muted | `#57534E` | `#A8A29E` | Labels, captions, helper text |
| Income (positive) | `#15803D` | `#4ADE80` | Earnings, gains |
| Expense (negative) | `#B91C1C` | `#F87171` | Outflows, losses |
| Investment (neutral) | `#6D28D9` | `#A78BFA` | Holdings, transfers to investments |

Semantic money colors (income / expense / investment) are used in tables, charts, and KPI cards consistently — green is *only* for inflows, red is *only* for outflows. Don't repurpose them for unrelated UI states.

### Typography

- **Body / UI**: Inter (variable). Tabular figures enabled wherever a money value is rendered.
- **Display**: Space Grotesk — wordmark, dashboard KPI numbers, page titles. Confident and modern without trend-chasing.
- **Money**: tabular numerals, decimal-aligned in tables. Currency symbol leads the amount.

### Visual language

- **Corners**: cards `rounded-lg` (8px), inputs/buttons `rounded-md` (6px), badges and the FAB `rounded-full`.
- **Depth**: borders define structure on flat surfaces. Shadows lift only floating elements (popovers, modals, toasts).
- **Density**: comfortable, not cramped. Tables ~14px row padding. Cards 24px internal padding.
- **Iconography**: Lucide only (ships with shadcn/ui). 1.5px stroke, no mixing icon libraries.
- **Motion**: 150ms ease-out is the default — match Volt's energy. Reserve longer animations for layout-level changes (route transitions, sidebar collapse).

## UX principles

OmniFlow is a daily-driver tool. Optimize for **speed and clarity**, not novelty. The user lives inside this app — every keystroke saved compounds.

- **Keyboard-first.** Every primary action has a shortcut. `Cmd/Ctrl+K` opens a global command palette. `Cmd/Ctrl+N` opens new-transaction from anywhere.
- **Quick-add everywhere.** Floating action button on every authenticated route, plus the keyboard shortcut, plus a sidebar entry.
- **Smart filters.** Filter chips (type, category, account, date range) with presets — This Month, Last 30d, YTD, Custom. Filter state lives in the URL so views are bookmarkable.
- **Inline editing** in transaction tables — click a cell to edit. No modal round-trip for small corrections.
- **Optimistic updates** for create / edit / delete via TanStack Query's `onMutate`. Roll back with a toast on error.
- **Skeletons, not spinners.** Skeletons match the final layout shape.
- **Designed empty states.** Volt + one-liner + primary CTA. Never blank.
- **Toasts for confirmation; modals only for destructive or multi-field actions.**
- **Dark mode is first-class.** Both modes designed in lockstep, not retrofitted.
- **Tabular numerals everywhere money appears.** Misaligned digits in a finance app erode trust.

Capabilities to plan for from day one (even if not built in phase 1, the architecture should not block them): command palette, global search across transactions, bulk actions on selected rows, drag-to-reassign category, CSV export, recurring transactions, multi-currency, budgets.

## Engineering guardrails for Claude

When implementing features in this repo:

- Money is `bigint` cents end-to-end. Never introduce `number` (float) for monetary values, anywhere.
- Server data → TanStack Query. UI state → Zustand. Form state → react-hook-form. Don't cross-pollinate; Supabase data never lives in Zustand.
- Zod schemas live next to the feature they describe and are the single source of truth for both forms and query response validation.
- shadcn/ui components live in `src/components/ui/` and are owned — edit them freely. Do not pull in a second component library.
- New visual values (color, spacing, font, radius) go through Tailwind / shadcn tokens. No hex literals in components.
- RLS is on for every Supabase table from migration 001. New tables ship with policies in the same migration that creates them.
- Default to: faster path, fewer clicks, clearer money column. When unsure between two designs, the one with less chrome wins.
- For any decision larger than a single component (new dependency, schema change, new top-level route, new data flow), surface the call to the user before writing code.
- **Always update the `## Status` section below whenever a step is completed** (or a meaningful slice within a step). The Status block is the one durable record of how far the project has come — let it drift and future sessions start cold. Update it in the same commit that ships the work.

## Database migrations — Supabase CLI workflow

Migrations live in `supabase/migrations/` as numbered SQL files (`001_init.sql`, `002_category_types.sql`, …). They are applied to the hosted project (`mkwncqhhnkhcznauzveq`) via the Supabase CLI, not by pasting into the dashboard SQL Editor.

**Standing authorization: Claude runs migration pushes itself.** The user has authorized Claude to run `supabase link` and `supabase db push` end-to-end whenever a new migration file lands. Don't ask before pushing — read the credentials from `.env` and apply. If a push fails, surface the error and stop; never silently skip a migration.

**Credentials live in `.env`** (this is a single-user, local project — `.env` already holds `SUPABASE_TOKEN` and `SUPABASE_DB_PASSWORD` alongside the runtime `VITE_SUPABASE_*` keys). Read them in PowerShell with:

```powershell
$envFile = Get-Content .env
$token  = ($envFile | Where-Object { $_ -match "^SUPABASE_TOKEN=" })       -replace "^SUPABASE_TOKEN=", ""
$dbpass = ($envFile | Where-Object { $_ -match "^SUPABASE_DB_PASSWORD=" }) -replace "^SUPABASE_DB_PASSWORD=", ""
$env:SUPABASE_ACCESS_TOKEN = $token   # what supabase CLI expects
$env:SUPABASE_DB_PASSWORD  = $dbpass
```

**CLI invocation** uses `pnpm dlx supabase` (the CLI is not installed globally on this machine, and `pnpm dlx` runs the published binary on demand without polluting global state):

```powershell
# Link once per machine (idempotent — safe to re-run):
pnpm dlx supabase link --project-ref mkwncqhhnkhcznauzveq --password $dbpass

# Apply every pending migration:
pnpm dlx supabase db push --password $dbpass

# Sanity check before/after:
pnpm dlx supabase migration list --password $dbpass
```

`db push` applies any migration files in `supabase/migrations/` whose version is not yet recorded in the project's `supabase_migrations.schema_migrations` table. The `Local | Remote` columns in `migration list` should match after a successful push.

**Rules:**
- Never edit a migration that has already been pushed to the hosted project. Ship a new numbered file instead.
- New tables ship with their RLS policies in the same migration that creates them.
- Idempotent where reasonable (`if not exists`, `where not exists`, conditional `update`s) so re-runs during development don't crater data.
- The `.env` `VITE_SUPABASE_*` variables are for the *runtime client*. The CLI auth is `SUPABASE_TOKEN` (mapped to `SUPABASE_ACCESS_TOKEN` env var) + `SUPABASE_DB_PASSWORD` for the direct DB connection.
- `.env` is local and gitignored — never commit it, never echo its values back to the user.

## Status

> **Implementation plan:** see [`implementation_plan.md`](./implementation_plan.md). Future sessions must consult it before starting any step from the Roadmap below. If reality drifts from the plan during implementation, edit both files in the same commit.

Another important thing to bear in mind is to the usage cost, every step will be done in separate sessions or until it hits the usage limits. Because of this you have to fully commit to follow the implementation plan without having previous session
knowledge. Be free to suggest any kind of editing that you feel is necessary! Always update this file when the steps are being concluded. 

Step 5 (command palette + FAB) is in. Done so far:

- **Step 1** — Scaffold: Vite + React + TS + Tailwind + shadcn/ui, admin layout shell with collapsible sidebar, theme toggle, placeholder routes.
- **Step 2** — Supabase + auth: hosted project wired, migration `001_init.sql` (accounts/categories/transactions, RLS, updated_at + new-user seed triggers), email+password login/signup, `<RequireAuth>` guards, typed query hooks.
- **Step 3a** — Transaction creation: react-hook-form + zod, dialog opened from sidebar Quick add / topbar New / Transactions page button / `N` keyboard shortcut, optimistic create via TanStack Query.
- **Step 3b** — Transactions table: filter chips (type + Source) with URL-bound state, edit dialog, soft delete with confirm, CSV export, dynamic uncategorized badge in sidebar.
- **English-by-default pass** — every app-controlled string is English; only user-typed data lives in whatever language the user types. `parseAmountToCents` accepts both en-US and pt-BR formats so input is forgiving.
- **Step 4** — Migration `003_accounts_balance_transfers.sql` lands `accounts.opening_balance_cents` + `archived_at`, drops `balance_cents`, extends `transactions.type` with `'transfer'` + `transfer_account_id`, and ships the `account_balances_v` derived-balance view (security_invoker). Accounts CRUD lives under a new tabbed Settings page (Profile / Sources / Preferences / Data) with create / edit / archive flows, opening-balance + currency picker, and live derived balances via `useAccountBalances()`. Transfer is a fourth transaction type — picker shows From / To and hides the category selector when type=transfer; the table renders `Source → Destination` for transfer rows. Sonner is wired (`<Toaster />` in `providers.tsx`) and every account + transaction mutation calls `toast.success` / `toast.error`; the dialog's redundant local error pane was removed.
- **Step 5** — Installed `cmdk` and shipped the canonical shadcn `command.tsx` primitive. New `src/features/command-palette/` holds a Zustand `registry` (palette open state + `Map<id, CommandItem>`), a `useRegisterCommands(...)` hook, the `palette-dialog.tsx` UI (grouped Navigate / Actions / Account, footer hints, loop nav), and a `provider.tsx` that mounts the dialog and registers the always-on commands (navigate to each route, New transaction, toggle theme, toggle sidebar, sign out). `keyboard-shortcuts.tsx` now toggles the palette on ⌘K / Ctrl+K (works even with the new-tx dialog open) and still keeps `N` for new-transaction. Topbar Search button opens the palette and shows a platform-aware `⌘K` / `Ctrl K` kbd hint. New `src/components/layout/fab.tsx` — 56px brand-yellow circle bottom-right, opens the new-tx dialog, hides while the dialog is open — mounted in `AdminLayout` so it lives on every authenticated route.
- **Migrations 001 + 002 + 003 applied** to the hosted project via `pnpm dlx supabase db push`. Project is linked; future migrations are pushed by Claude automatically as soon as the SQL file lands (see *Database migrations* above).

Next step (step 6a) is **Dashboard KPI cards + sparklines + time-range chips** — install `recharts`, build `src/features/dashboard/{kpi-card,sparkline,time-range-chips}.tsx`, replace the placeholder text in `dashboard-page.tsx` with 4 KPI cards (Net worth via `useAccountBalances()`, Income, Spending, Invested) showing big-number + MoM delta + 7-point inline sparkline, and add URL-bound `range=` chips (7d / 30d / MTD / YTD). See `implementation_plan.md` for detail.

## Roadmap

Condensed checklist; flip the box and add a Status bullet when a step lands. Detail lives in `implementation_plan.md` — keep these lines one-liners.

- [x] **Step 4** — Migration 003 + Accounts CRUD + balance view + Sonner toasts
- [x] **Step 5** — Command palette (⌘K) + FAB
- [ ] **Step 6a** — Dashboard: KPI cards + sparklines + time-range chips
- [ ] **Step 6b** — Dashboard: cashflow + accounts list + net-worth chart
- [ ] **Step 7** — Categories page (grid, counts, CRUD)
- [ ] **Step 8** — Migration 004 + Investments page + holdings
- [ ] **Step 9** — Insights: calendar heatmap + day breakdown
- [ ] **Step 10** — Insights: what-if simulator
- [ ] **Step 11** — Insights: auto-detected pattern cards
- [ ] **Step 12** — Settings: Profile + Preferences + Data tabs (Accounts tab lands in Step 4)
- [ ] **Step 13** — Migration 005 + Recurring rules + idempotent materializer
- [ ] **Step 14** — Migration 006 + Budgets + breach alerts
- [ ] **Step 15** — Multi-currency display layer
- [ ] **Step 16** — i18n EN / PT-BR
- [ ] **Step 17** — PWA (manifest, service worker, install)
- [ ] **Step 18** — Polish: empty states, 404, skeletons, login redesign
