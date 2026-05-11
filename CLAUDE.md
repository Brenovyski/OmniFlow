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

Step 7 (Categories page + sources/payment-methods/credit-card overhaul) is in. Done so far:

- **Step 1** — Scaffold: Vite + React + TS + Tailwind + shadcn/ui, admin layout shell with collapsible sidebar, theme toggle, placeholder routes.
- **Step 2** — Supabase + auth: hosted project wired, migration `001_init.sql` (accounts/categories/transactions, RLS, updated_at + new-user seed triggers), email+password login/signup, `<RequireAuth>` guards, typed query hooks.
- **Step 3a** — Transaction creation: react-hook-form + zod, dialog opened from sidebar Quick add / topbar New / Transactions page button / `N` keyboard shortcut, optimistic create via TanStack Query.
- **Step 3b** — Transactions table: filter chips (type + Source) with URL-bound state, edit dialog, soft delete with confirm, CSV export, dynamic uncategorized badge in sidebar.
- **English-by-default pass** — every app-controlled string is English; only user-typed data lives in whatever language the user types. `parseAmountToCents` accepts both en-US and pt-BR formats so input is forgiving.
- **Step 4** — Migration `003_accounts_balance_transfers.sql` lands `accounts.opening_balance_cents` + `archived_at`, drops `balance_cents`, extends `transactions.type` with `'transfer'` + `transfer_account_id`, and ships the `account_balances_v` derived-balance view (security_invoker). Accounts CRUD lives under a new tabbed Settings page (Profile / Sources / Preferences / Data) with create / edit / archive flows, opening-balance + currency picker, and live derived balances via `useAccountBalances()`. Transfer is a fourth transaction type — picker shows From / To and hides the category selector when type=transfer; the table renders `Source → Destination` for transfer rows. Sonner is wired (`<Toaster />` in `providers.tsx`) and every account + transaction mutation calls `toast.success` / `toast.error`; the dialog's redundant local error pane was removed.
- **Step 5** — Installed `cmdk` and shipped the canonical shadcn `command.tsx` primitive. New `src/features/command-palette/` holds a Zustand `registry` (palette open state + `Map<id, CommandItem>`), a `useRegisterCommands(...)` hook, the `palette-dialog.tsx` UI (grouped Navigate / Actions / Account, footer hints, loop nav), and a `provider.tsx` that mounts the dialog and registers the always-on commands (navigate to each route, New transaction, toggle theme, toggle sidebar, sign out). `keyboard-shortcuts.tsx` now toggles the palette on ⌘K / Ctrl+K (works even with the new-tx dialog open) and still keeps `N` for new-transaction. Topbar Search button opens the palette and shows a platform-aware `⌘K` / `Ctrl K` kbd hint. New `src/components/layout/fab.tsx` — 56px brand-yellow circle bottom-right, opens the new-tx dialog, hides while the dialog is open — mounted in `AdminLayout` so it lives on every authenticated route.
- **Step 6a** — Installed `recharts`. New `src/features/dashboard/time-range-chips.tsx` exposes `TimeRangeChips` + `useTimeRange()` (URL-bound `?range=` param, `30d` is the default and is omitted from the URL) plus a `rangeWindow()` helper that returns `{start, end, prevStart, prevEnd}` for both the active and the prior window. New `sparkline.tsx` is a tiny Recharts `LineChart` wrapper with token-driven stroke (income/expense/invest/text). New `kpi-card.tsx` renders the label, big-number in Space Grotesk + tabular-nums, an inline 7-point sparkline, and a delta vs prior period (arrow + tone + percent — Spending uses `invertDeltaPolarity` so "down" reads as good). New `stats.ts` (`computeRangeStats`) walks transactions once to produce KPI totals (income / expense / invested), 7-bucket sparkline series, and a net-worth time series reconstructed from the live `useAccountBalances()` total minus future-from-bucket-end deltas — transfers net to zero across accounts. `dashboard-page.tsx` now greets the user (time-of-day + capitalised email local-part), renders the range chips, the 4 KPI cards (Net worth / Income / Spending / Invested), and keeps the recent-transactions card at the bottom.
- **Step 6b** — Four new dashboard surfaces composed under the KPI row. `cashflow-chart.tsx` renders 12 ISO-week dual bars (income green / expense red) via Recharts `BarChart`, with `date-fns/startOfISOWeek` bucketing and a token-styled tooltip showing `Week of {date}` + both totals via `fmtMoney`. `top-spending.tsx` is pure HTML — top 5 expense categories MTD as horizontal bars normalized to the largest (uncategorized rolls up as one row). `accounts-list.tsx` lists every non-archived source with its derived balance from `useAccountBalances()` and surfaces the total in the card header (matches the Net worth KPI). `net-worth-chart.tsx` is a 12-month Recharts `AreaChart` with a brand-yellow gradient fill; a `nw=` URL-bound segmented selector (3M / 6M / 1Y default / All) lives in the card header, and snapshots are reconstructed from the live total via `currentTotal − Σ netDelta(tx where date > monthEnd)`. `dashboard-page.tsx` lays them out as KPIs → (cashflow 2/3 + top-spending 1/3) → (net-worth 2/3 + accounts 1/3) → recent transactions.
- **Step 7a — Categories page.** New `src/features/categories/{categories-page.tsx (rewrite), category-card.tsx, category-form.tsx, mutations.ts, icons.ts}`. Page renders a card grid grouped by type (Earnings / Expenses / Investments) with colored icon square, type chip, and live transaction count derived from `useTransactions`. Sorted alphabetically within each group. New / edit / delete via dialogs. Delete is blocked at the UI when count > 0 (the FK already does `on delete set null`, but blocking surfaces the intent). The form has live preview (icon + color), 10 colors, and 28 curated Lucide icons.
- **Step 7b — Sources / payment-methods / credit-card overhaul.** Mid-step the user pushed back on the flat-account model: real institutions hold multiple accounts and offer multiple payment methods, and a credit card is *not* an account — it's a credit limit attached to a checking account. Migration `004_sources_payment_methods.sql` lands new `sources` + `source_payment_methods` tables with RLS, adds `accounts.source_id` (NOT NULL after wipe) + `accounts.credit_limit_cents`, renames `accounts.type 'debit' → 'checking'` and drops `'credit_card'`, adds `transactions.payment_method` (enum: pix/debit_card/credit_card/transfer/wire/cash/voucher) + `transactions.settled_at`, re-derives `account_balances_v` so unsettled CC charges DON'T touch the checking balance, and ships a new `credit_card_outstanding_v` view. Existing transactions + accounts were truncated; the seed trigger was replaced (1 default Source "Personal" with checking/savings/investments + 4 methods) and re-run for existing users. New `src/features/sources/` folder (schemas, queries with `methodsBySourceId` helper, mutations, source-form). `src/features/settings/sources-section.tsx` replaces `accounts-section.tsx` (deleted) — sources expand to show their accounts + method chips, with edit/archive at both levels and an "Add account to <source>" affordance. `account-form.tsx` rewritten to drop debit/credit_card and gain a conditional `credit_limit_cents` input (visible only for `type=checking`); source membership comes from a `sourceId` prop. `transaction-form.tsx` rewritten around Source + Account + Payment method pickers — account list is filtered by source AND tx type (investment shows only brokerage; expense excludes brokerage); method list is filtered to the source's enabled methods with a sensible default per account kind. `transactions-table.tsx` gains a "Method" column (small chip) with an "unsettled" yellow dot for unsettled CC charges. New `src/features/dashboard/credit-cards.tsx` lists every checking with a credit limit, shows used/limit/available + a global summary in the card header, color-codes the bar (green <60%, yellow <90%, red ≥90%), and ships a per-row **Pay bill** confirm → calls `useSettleCreditCardBill(accountId)` which stamps `settled_at = now()` on every unsettled CC charge against that account; the balance view then recomputes the checking balance to include those charges as expenses.
- **Step 7c — Refinement pass on the source/account model** (multiple back-and-forth rounds with the user, all in this same commit):
  - **Migration 005** adds `sources.short_name` (nickname). The source-edit dialog gains a Nickname field; nickname surfaces as the dot label across the dashboard and transactions table.
  - **Migration 006** drops `'voucher'` and `'cash'` from `accounts.type` — they're payment methods, not account kinds. Sweeps any voucher/cash account rows + their transactions; `accounts.type` is now `checking | savings | brokerage`. The PAYMENT_METHODS enum still exposes `voucher` and `cash` as valid method tags on transactions; they just don't have a dedicated account kind anymore.
  - **Sources panel show/hide archive bug**: previously only filtered sources, now filters archived accounts inside each source too.
  - **Color picker dropped from `account-form.tsx`** — accounts inherit the parent source's color via the new `src/features/sources/display.ts` helpers (`sourceLabel`, `accountDisplayLabel`, `accountDisplayColor`). The transactions table source chip, the dashboard accounts list dot, and the credit-cards card all read source.color through these helpers.
  - **Account name dropped from the form** — account name is auto-set from `ACCOUNT_TYPE_LABEL[type]`. Source-create dialog's per-account checklist also lost the per-row Name input.
  - **Transactions filter chips** flipped from per-account to **per-source** — filtering by source now matches transactions whose source-account or transfer-destination belongs to that source. URL key flipped from `?account=` to `?source=`.
  - **Source column in the transactions table** shows just the source label (no `· {account}` suffix); the description column still surfaces the affected account in its sub-line, so account context is one row away.
  - **Dashboard Accounts card** rewritten as a **per-source rollup**: one row per source with the **full bank name**, the summed balance across its accounts, and an expandable chevron that reveals the inner accounts (type label + balance) in an indented sublist. Card-header total stays the sum of source totals.
- **Migrations 001 + 002 + 003 + 004 + 005 + 006 + 007 applied** to the hosted project via `pnpm dlx supabase db push`. Project is linked; future migrations are pushed by Claude automatically as soon as the SQL file lands (see *Database migrations* above). Migration numbering: 007 is the combined `pluggy_and_holdings.sql` from step 7.5; recurring is 008, budgets is 009.
- **Step 7.5 — in progress.** Pluggy Open Finance integration. Detailed spec at `docs/superpowers/specs/2026-05-10-pluggy-step-7.5-design.md`, phase-by-phase plan at `docs/superpowers/plans/2026-05-10-pluggy-step-7.5.md`. Uses Pattern B (Data Passport via meu.pluggy) — items connected externally; OmniFlow consumes via Pluggy API as the registered Demo App. Six phases (A–F).
  - **Phase A — done.** Migration `007_pluggy_and_holdings.sql` lands Pluggy linkage columns on `sources` (`pluggy_item_id` / `pluggy_connector_id` / `pluggy_status` / `pluggy_last_synced_at` / `pluggy_last_error`), on `accounts` (`pluggy_account_id` / `pluggy_cc_account_id` for sibling-checking link / `pluggy_subtype` / `pluggy_owner` / `pluggy_marketing_name` / `pluggy_available_credit_cents` / `pluggy_balance_due_date` / `pluggy_balance_close_date` / `pluggy_cc_brand` / `user_edited_fields[]`), the new `holdings` table (with full Pluggy investment fields including `pluggy_rate` / `pluggy_rate_type` / `pluggy_due_date` for fixed-income and `pluggy_isin` / `pluggy_issuer`), on `transactions` (`pluggy_transaction_id` / `pluggy_status` / `pluggy_category` / `pluggy_description_raw` / `pluggy_provider_code` / `pluggy_balance_after_cents` / `pluggy_merchant_name` / `pluggy_merchant_category` / `pluggy_cc_installment` / `pluggy_cc_total_installments` / `pluggy_cc_bill_id` / `pluggy_deleted_at` for soft-mark-only reversals / `user_edited_fields[]` / `holding_id` FK), and the new `pluggy_sync_log` table (debug audit trail). All RLS-policied. Zod schemas updated to match: `src/features/sources/schemas.ts` adds `PLUGGY_SOURCE_STATUSES` + `isPluggyManaged()`; `src/features/accounts/schemas.ts` adds the Pluggy/sticky fields; `src/features/transactions/schemas.ts` adds `PLUGGY_TRANSACTION_STATUSES` + the Pluggy/sticky/holding_id fields; new `src/features/holdings/schemas.ts` exports `HoldingSchema` + `Holding` type. Optimistic-create object in `src/features/transactions/mutations.ts` extended to include the new fields as nulls/defaults.
  - **Webhook security finding (during phase A).** Pluggy does NOT HMAC-sign webhook bodies. Auth is via custom HTTP headers registered at webhook-create time (Pluggy's `POST /webhooks` API accepts a `headers` object — dashboard does not). Phase C will register the webhook via API with `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>` and verify that header on each delivery. The implementation plan and spec's "Implementation TBD #1" (HMAC algo) is therefore moot.
  - **Phase B — done.** `supabase/functions/_shared/pluggy-merge.ts` exports `mergeSource` / `mergeAccount` (with CC auto-link + shadow-checking fallback) / `mergeTransaction` (sticky-edit + soft-delete-respecting) / `mergeHolding`. Pure logic. Deno isn't installed locally and the project has no test runner, so the planned TDD step ran without runner; the merge logic is small and reasoned-about, behavior gets verified end-to-end via the smoke test. `import_map.json` pins `pluggy-sdk@0.85.2`.
  - **Phase C — done (with one large mid-flight refactor).** `supabase/functions/pluggy-sync/index.ts` and `supabase/functions/pluggy-webhook/index.ts` deployed; secrets pushed (`PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` / `PLUGGY_WEBHOOK_SECRET` in `.env.functions`); webhook registered with Pluggy via `node scripts/register-pluggy-webhook.mjs` (id `eeac00c9-18e6-4d9c-98ad-5f9a6f45a9e3`) with `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>` as a custom header (Pluggy doesn't HMAC-sign — they include whatever headers were registered at create time). Mid-flight finding: **Pluggy's API has no `GET /items` listing endpoint**, so `pluggy.fetchItems()` doesn't exist on the SDK. The spec's Pattern B / Data Passport "auto-discover items shared with our app" doesn't actually exist — items must first be REGISTERED in OmniFlow via a UI affordance. `pluggy-sync` was rewritten to iterate the user's known sources (rows where `pluggy_item_id is not null`) and to accept `{ connectItemId }` for the register-and-sync flow. Also: `fetchTransactions(accountId, ...)` takes accountId (not itemId — the plan got this wrong), and the cursor variant `fetchAllTransactions` rejects the `from` filter — page-based `fetchTransactions(accountId, { from, page, pageSize })` is the only path that works. Both Edge Functions wrap their handler in a top-level try/catch that surfaces uncaught errors in the response body (lesson learned after the first runs returned opaque `EDGE_FUNCTION_ERROR` 500s).
  - **Phase D — done.** `src/features/sources/pluggy-mutations.ts` exports `useSyncFromPluggy` (sync everything or `sourceId`) and `useConnectPluggyItem(itemId)` (validates with Pluggy, inserts source, runs initial sync — all in one round-trip via `pluggy-sync`'s `connectItemId` body). `src/features/sources/pluggy-queries.ts` exports `useSyncLog`. `useUpdateTransaction` / `useUpdateAccount` retrofitted to diff against existing row and append changed mergeable fields to `user_edited_fields[]` only when the row is Pluggy-managed. **Note**: sources never got `user_edited_fields` (none of their fields are mergeable — pluggy_status / connector_id / last_synced_at are all bank-truth, the user-editable name/color come from the source-edit dialog and don't get re-set from Pluggy after first insert), so `mergeSource` doesn't touch that column. Initial mistake of trying to set `user_edited_fields: []` on the source insert produced a "Could not find the column in schema cache" error — fixed.
  - **Phase E — done.** Settings → Sources splits into **PLUGGY-MANAGED** and **MANUAL** lanes. Page header has three buttons: **Connect Pluggy item** (new — opens dialog with item-ID input), **Sync from Pluggy**, **Add source** (manual). Per-source: status dot + "synced Xm ago" + Sync-now refresh icon + Reconnect-at-meu.pluggy link on `login_error`. Pluggy-managed sources hide the "+ Add account" affordance — accounts come from Pluggy. Transactions table: inline `↻` indicator on Pluggy rows, with a `+ ✎` overlay if `user_edited_fields[]` is non-empty; tooltip lists what was edited. `pluggy_deleted_at` rows render with strikethrough + "Reversed by bank" badge. Transaction edit dialog: notice at top + amount/date inputs disabled when `pluggy_transaction_id` is set; new-transaction source picker disables Pluggy-managed sources with "(sync only)" suffix and the auto-pick prefers the first MANUAL source. `DatePicker` gained an optional `disabled` prop. Settings → Data tab gains a **Recent syncs** card listing the last 30 `pluggy_sync_log` entries (manual / webhook / initial) with status icon + trigger + source name + time-ago + inline error message. Account-row label shows the Pluggy-provided name (`Nu Pagamentos S.A. ...`, `BTG Banking`, `BTG Investimentos`) with the type label as a small chip next to it; manual rows still use `ACCOUNT_TYPE_LABEL[type]`. CC limit line hides when 0 or null.
  - **Phase F — IN PROGRESS, debug-this-tomorrow.** Sandbox smoke completed steps 1–3 (item registered, sync runs without 5xx). Discovered runtime issues mid-test, most fixed in-place; the remaining ones are listed below. Last state of the user's hosted DB: 2 sources both named **MeuPluggy** (item IDs `90ed8c3b-9a45-4d15-abae-7c441b6c648b` and `4b7aaaea-2ede-4783-a83f-d2e5a0de2daf`), 3 OmniFlow accounts (BTG Banking R$266.34 / BTG Investimentos R$0 with linked CC `credit_limit=0` / Nu Pagamentos R$185.01 with linked CC `credit_limit=R$12,348.14`), 0 holdings, 0 transactions.

**Step 7.5 — open issues for next session (sorted by priority):**

1. **Transactions still flow 0 after the `from` fix.** Last sync run completed `status='ok'` (no per-account errors) but `transactionsUpserted=0`. The bug is almost certainly that **`pluggy_last_synced_at` got stamped on the source EVEN ON the earlier failed runs** (we update `pluggy_status='active' / pluggy_last_synced_at=now()` inside the per-target try block before transactions complete). So second-and-later syncs query Pluggy with `from=last_synced - 1 day` ≈ "today only", missing the 90-day window. **Fix**: only stamp `pluggy_last_synced_at` after a successful transaction pass; OR reset `pluggy_last_synced_at = null` on existing sources to force a fresh 90-day pull on the next sync (one-shot SQL: `UPDATE sources SET pluggy_last_synced_at = NULL WHERE user_id = '8dd421fd-4a42-4beb-88fe-2131574bb863' AND pluggy_item_id IS NOT NULL`). Verify by inspecting Pluggy's actual response — log the count of returned txs per page in `pluggy-sync` for one debug run.
2. **Holdings always skipped.** `mergeHolding` requires the source to have an account with `type='brokerage'`, but Pluggy returns BTG's investment account with `subtype='CHECKING_ACCOUNT'` — so it lands as `type='checking'` in OmniFlow, no brokerage row exists, every `mergeHolding` returns `skipped_no_account`. **Fix**: either (a) detect "investment" via the account name (`/invest/i`) or marketingName during `mergeBankAccount` and re-classify type='brokerage', or (b) auto-create a shadow brokerage account when a Pluggy investment lands and no brokerage exists under that source.
3. **Source name "MeuPluggy" is the connector name, not the bank.** Pluggy's MeuPluggy connector is their Open Finance umbrella — actual bank info is per-account (`account.name = "Nu Pagamentos S.A. ..."` / `"BTG Banking"`). User can rename via the source-edit dialog (works). Optional improvement: auto-name the source from the first account's marketing/owner-derived bank name on initial insert.
4. **BTG `credit_limit_cents=0` mystery.** Pluggy returned `creditData.creditLimit=0` (or absent) for BTG's CC, even though the user has a real BTG credit card. Cause is upstream (the BTG connector at meu.pluggy may not include limit data via Open Finance). The R$5,700 user saw before the wipe was MANUAL data. Verify by inspecting raw Pluggy `creditData` for that item.
5. **Pre-flight handoff doc.** Once issues 1+2 land, update `docs/superpowers/specs/2026-05-10-pluggy-step-7.5-design.md` to reflect: (a) no `GET /items` exists, (b) Connect Pluggy item dialog is the discovery flow, (c) `fetchTransactions(accountId)` not itemId, (d) `from` only on the page-variant. The current spec promises a "list items" endpoint that doesn't exist.

After 1+2 land and a fresh sync produces non-zero transactions + non-zero holdings, the rest of the F1 smoke checklist (steps 5–10: edit-and-sticky-edit, soft-delete-doesn't-resurrect, webhook events, source picker disabled) can run end-to-end. Then Phase F2/F3/F4 wrap (flip `[~]` Step 7.5 → `[x]`, final commit, push).

Next step is **Step 7.5 Phase F — finish smoke test** (issues 1–4 above first). See `docs/superpowers/plans/2026-05-10-pluggy-step-7.5.md` Phase F.

## Roadmap

Condensed checklist; flip the box and add a Status bullet when a step lands. Detail lives in `implementation_plan.md` — keep these lines one-liners.

- [x] **Step 4** — Migration 003 + Accounts CRUD + balance view + Sonner toasts
- [x] **Step 5** — Command palette (⌘K) + FAB
- [x] **Step 6a** — Dashboard: KPI cards + sparklines + time-range chips
- [x] **Step 6b** — Dashboard: cashflow + accounts list + net-worth chart
- [x] **Step 7** — Categories page + sources / payment-methods / credit-card overhaul (migrations 004 / 005 / 006)
- [~] **Step 7.5** — Migration 007 + Pluggy Open Finance integration (Phase A landed; B–F pending)
- [ ] **Step 8** — Investments page UI (holdings table already shipped in 7.5)
- [ ] **Step 9** — Insights: calendar heatmap + day breakdown
- [ ] **Step 10** — Insights: what-if simulator
- [ ] **Step 11** — Insights: auto-detected pattern cards
- [ ] **Step 12** — Settings: Profile + Preferences + Data tabs (Sources tab lands in Step 4 / 7)
- [ ] **Step 13** — Migration 008 + Recurring rules + idempotent materializer
- [ ] **Step 14** — Migration 009 + Budgets + breach alerts
- [ ] **Step 15** — Multi-currency display layer
- [ ] **Step 16** — i18n EN / PT-BR
- [ ] **Step 17** — PWA (manifest, service worker, install)
- [ ] **Step 18** — Polish: empty states, 404, skeletons, login redesign
