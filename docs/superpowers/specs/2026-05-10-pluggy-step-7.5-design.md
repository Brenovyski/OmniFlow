# Step 7.5 — Pluggy Open Finance integration

**Status:** design — pending implementation plan
**Author:** brainstormed with Suguru on 2026-05-10
**Slot:** between current Step 7 (categories + sources/payment-methods) and Step 8 (Investments page)
**Migration number:** `007_pluggy_and_holdings.sql` — combined with the previously-planned holdings migration; recurring becomes 008, budgets becomes 009

## Goal

Auto-fetch financial data (accounts, transactions, credit-card outstanding, investment holdings) from the user's banks into OmniFlow via Pluggy, while preserving manual entry for institutions not covered by Pluggy. Read-only — no payments, no writes back to Pluggy. The user's database is the long-term store of record; Pluggy is a live feed that contributes to it.

## Constraints locked at design time

1. **Pattern B only (Data Passport via meu.pluggy).** The user's banks are already connected at meu.pluggy.ai. The "Pluggy Demo App" credentials (`clientId/clientSecret`) authorize OmniFlow to read items shared with the app. **No Connect Widget in OmniFlow.** If a bank Pluggy supports isn't on meu.pluggy, the user creates a manual source — same as a non-Pluggy bank. The widget can be added later as 7.5b if/when needed.
2. **Read-only scope.** Only `GET`-style operations against Pluggy. No `pluggy-payments` skill. Identity / Loans endpoints out of scope.
3. **Pluggy is append-only into OmniFlow.** Pluggy retains ~12 months of history; OmniFlow retains forever. Once a transaction lands in our DB, it stays — even after Pluggy stops returning it.
4. **User edits are sticky across re-syncs.** Per-row `user_edited_fields text[]` records which mergeable columns the user has touched. The merge module skips those fields when applying Pluggy data.
5. **Bank-truth fields are never user-editable.** `amount_cents`, `occurred_on`, `currency` always come from Pluggy; the transaction edit dialog disables them when the row has `pluggy_transaction_id` set.
6. **Pluggy-managed sources lock manual entry.** A source is either Pluggy-managed (everything comes from sync) or manual (user types it in). The transaction form disables Pluggy-managed sources in the source picker.
7. **Credit cards stay modeled as `payment_method='credit_card'` against a checking with `credit_limit_cents`.** Pluggy's separate CC account gets auto-linked to the sibling checking under the same Item via a new `accounts.pluggy_cc_account_id` column. Per Suguru's mental model: a CC is part of a banking relationship, not a standalone account.
8. **No JSONB columns on transactions, accounts, or holdings.** Every Pluggy field we use gets an explicit column (typed, indexable). Validated against the agent-skills `AGENTS.md` recommendation and ~13× more storage-efficient than `pluggy_raw jsonb` over 5 years of usage.
9. **Initial-import history depth: 90 days.** "Load older history" deferred — if needed, ship as 7.5b. Webhooks fill in everything after the cut.
10. **Cross-bank transfer double-counting: known limitation, manual fix.** No auto-detect heuristic in 7.5. User re-classifies one side as `type='transfer'` with the destination set; sticky edits ensure the fix persists.

## Architecture

```
┌────────────── Browser (React SPA) ──────────────┐
│  Settings ▸ Sources                             │
│   ├─ "Sync from Pluggy" button                  │
│   └─ Per-source: ⋯ menu (Sync now, Reconnect…)  │
│                                                 │
│  Transactions table — synced & edited badges    │
│  Transaction edit dialog — sticky-edit tracking │
└─────────────────────┬───────────────────────────┘
                      │ JWT-auth'd POST
                      ▼
        Supabase Edge Functions (Deno)
   ┌───────────────────────────────────────────┐
   │  pluggy-sync                              │
   │   • Auth: user JWT                        │
   │   • Body: { sourceId? }  (omit = all)     │
   │   • Authenticates as Demo App via         │
   │     PLUGGY_CLIENT_ID/SECRET               │
   │   • Calls GET /items, walks each one      │
   │   • Upserts source / accounts / holdings  │
   │   • Pulls last-90d transactions on first  │
   │     sync, last-1d-overlap on subsequent   │
   │                                           │
   │  pluggy-webhook                           │
   │   • Auth: HMAC vs PLUGGY_WEBHOOK_SECRET   │
   │   • Switch on event.event                 │
   │   • Look up user_id via                   │
   │     sources.pluggy_item_id                │
   │   • Service-role-key writes,              │
   │     constrained by derived user_id        │
   │                                           │
   │  ── shared: _shared/pluggy-merge.ts ──    │
   │  • mergeSource / Account / Tx / Holding   │
   │  • respects user_edited_fields            │
   │  • never resurrects soft-deleted rows     │
   │  • writes pluggy_sync_log entry           │
   └────────────────┬──────────────────────────┘
                    │ writes
                    ▼
            Postgres (Supabase, RLS-enabled)
```

**SDK:** `pluggy-sdk` (npm), imported in Edge Functions via `import { PluggyClient } from "npm:pluggy-sdk"`. Falls back to raw `fetch` against Pluggy's REST API if the SDK has Deno friction at implementation time.

**No `pluggy-connect-token` Edge Function** — that was for the embedded widget (Pattern A), which 7.5 doesn't ship.

## Schema — migration `007_pluggy_and_holdings.sql`

### Sources additions

```sql
alter table sources add column pluggy_item_id        text;
alter table sources add column pluggy_connector_id   integer;     -- 211=Nubank, etc.
alter table sources add column pluggy_status         text check (pluggy_status in
  ('active','login_error','updating','outdated','disconnected'));
alter table sources add column pluggy_last_synced_at timestamptz;
alter table sources add column pluggy_last_error     jsonb;       -- only field where JSONB is justified — error payloads are unbounded shape

create unique index sources_pluggy_item_uniq
  on sources(user_id, pluggy_item_id) where pluggy_item_id is not null;
```

A Source is Pluggy-managed iff `pluggy_item_id is not null`. The "Pluggy lane" filter in the Sources UI is exactly this predicate.

### Accounts additions

```sql
alter table accounts add column pluggy_account_id       text;     -- the bank/checking/savings/brokerage Pluggy id
alter table accounts add column pluggy_cc_account_id    text;     -- the linked CC Pluggy id, only set on checkings with a linked CC
alter table accounts add column pluggy_subtype          text;     -- 'CHECKING_ACCOUNT'|'SAVINGS_ACCOUNT'|'CREDIT_CARD'
alter table accounts add column pluggy_owner            text;
alter table accounts add column pluggy_marketing_name   text;
-- credit-card-only (NULL for non-CC accounts):
alter table accounts add column pluggy_available_credit_cents bigint;
alter table accounts add column pluggy_balance_due_date    date;
alter table accounts add column pluggy_balance_close_date  date;
alter table accounts add column pluggy_cc_brand            text;
alter table accounts add column user_edited_fields         text[] not null default '{}';

create unique index accounts_pluggy_account_uniq
  on accounts(user_id, pluggy_account_id) where pluggy_account_id is not null;
create unique index accounts_pluggy_cc_uniq
  on accounts(user_id, pluggy_cc_account_id) where pluggy_cc_account_id is not null;
```

Dropped from the Pluggy account schema (not promoted, not stored as JSONB): `bankData.*` (overdraft fields, autoinvested balance — none currently displayed), `creditData.level`, `holderType`, `isLimitFlexible`, `disaggregatedCreditLimits`. `creditData.creditLimit` populates the existing `accounts.credit_limit_cents`.

### Transactions additions

```sql
alter table transactions add column pluggy_transaction_id    text;
alter table transactions add column pluggy_status            text check (pluggy_status in ('PENDING','POSTED'));
alter table transactions add column pluggy_category          text;          -- coarse hint chip in the table
alter table transactions add column pluggy_description_raw   text;          -- original bank string before enrichment
alter table transactions add column pluggy_provider_code     text;
alter table transactions add column pluggy_balance_after_cents bigint;       -- running balance, when bank provides
alter table transactions add column pluggy_merchant_name     text;
alter table transactions add column pluggy_merchant_category text;
alter table transactions add column pluggy_cc_installment    int;            -- "3 of 12" CC installments
alter table transactions add column pluggy_cc_total_installments int;
alter table transactions add column pluggy_cc_bill_id        text;           -- groups CC tx by bill cycle
alter table transactions add column pluggy_deleted_at        timestamptz;    -- Pluggy reported reversal; soft-mark only
alter table transactions add column user_edited_fields       text[] not null default '{}';
alter table transactions add column holding_id               uuid references holdings(id) on delete set null;

create unique index transactions_pluggy_uniq
  on transactions(user_id, pluggy_transaction_id) where pluggy_transaction_id is not null;
```

Dropped from the Pluggy transaction schema: `paymentData.payer/receiver` identity (PII we don't display), `boletoMetadata.*`, `creditCardMetadata.payeeMCC/cardNumber/purchaseDate/totalAmount`, `merchant.cnpj/cnae/businessName`. None used by current OmniFlow surfaces; can be promoted later if needed.

### New `holdings` table

```sql
create table holdings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  account_id               uuid not null references accounts(id)   on delete cascade,
  ticker                   text,                              -- nullable: BR fixed-income often has no ticker
  name                     text not null,
  shares                   numeric(20,6) not null default 0,
  avg_cost_cents           bigint not null default 0,
  current_price_cents      bigint not null default 0,
  currency                 text not null default 'BRL',
  notes                    text,
  pluggy_investment_id     text,
  pluggy_status            text check (pluggy_status in ('ACTIVE','PENDING','TOTAL_WITHDRAWAL')),
  pluggy_isin              text,
  pluggy_issuer            text,
  pluggy_amount_profit_cents bigint,
  pluggy_taxes_cents       bigint,
  pluggy_rate              numeric(8,4),                       -- interest rate for fixed income
  pluggy_rate_type         text,                               -- 'CDI' | 'SELIC' | 'IPCA' | ...
  pluggy_last_12m_rate     numeric(8,4),
  pluggy_due_date          date,                               -- maturity for fixed income
  user_edited_fields       text[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
alter table holdings enable row level security;
create policy "holdings_owner" on holdings using (auth.uid() = user_id);

create unique index holdings_pluggy_investment_uniq
  on holdings(user_id, pluggy_investment_id) where pluggy_investment_id is not null;
```

Dropped from the Pluggy investment schema: `transactions[]` (we already model investment buy/sell as our own `transactions` rows linked via `holding_id`), `metadata.*`, `institution.*`. `value` and `quantity` map to `current_price_cents` and `shares`.

### New `pluggy_sync_log` table

```sql
create table pluggy_sync_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source_id     uuid references sources(id) on delete cascade,
  trigger       text not null check (trigger in ('manual','webhook','initial','reconnect')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  status        text not null check (status in ('running','ok','error')),
  counts        jsonb,                  -- {accounts_inserted, transactions_inserted, transactions_updated, holdings_inserted, ...}
  error_message text
);
alter table pluggy_sync_log enable row level security;
create policy "sync_log_owner" on pluggy_sync_log using (auth.uid() = user_id);
```

Single JSONB column accepted here because the counts shape varies per sync trigger and is purely a debugging aid — not queried by the dashboard.

### What 007 does NOT touch

- `account_balances_v` view stays as-is. Pluggy-imported transactions follow the same sign rules as manual ones.
- `credit_card_outstanding_v` view stays as-is. CC charges with `payment_method='credit_card' AND settled_at IS NULL` aggregate the same regardless of source.
- Existing RLS policies on `sources/accounts/transactions` cover the new columns automatically.
- The `categories` table is untouched. Pluggy's coarse category lives in `transactions.pluggy_category` as a string hint; it never auto-creates an OmniFlow category.

### Migration housekeeping

- Apply the existing `set_updated_at` trigger pattern (from migration 001) to both `holdings` and `pluggy_sync_log` so `updated_at` is maintained on every UPDATE.
- SQL ordering inside the migration file: alter `sources` → alter `accounts` → create `holdings` (with RLS, trigger, indexes) → alter `transactions` (the `holding_id` FK now resolves) → create `pluggy_sync_log` (with RLS, trigger). The chunks above are grouped by table for readability; the implementation plan emits them in FK-safe order.

### Edge cases for CC auto-link

A single Pluggy Item can return multiple accounts including credit cards. The merge module handles three cases:

1. **One checking + one CC under same Item (the common case — Nubank, BTG):** auto-link CC to the checking. `accounts.pluggy_cc_account_id` on the checking points at the Pluggy CC accountId. CC charges arrive with `payment_method='credit_card'` against the checking. No prompt.
2. **Multiple checkings + one CC under same Item (rare in BR):** link CC to the checking with the higher current balance, or to whichever was created first if balances tie. User can re-assign in Settings → Sources by editing the CC sub-row. One-time decision; persists via `user_edited_fields` on the account.
3. **CC-only Item (no checking under same Item):** auto-create a `$0`-opening-balance checking under that Source to host the CC. The shadow checking has no transactions of its own; it's purely the carrier for the credit limit. Naming: `"<Connector name> Card"`.

### Source archive / disconnect semantics

Archiving a Pluggy-managed source (existing soft-archive flow from step 7) **pauses syncing** — `pluggy_sync` skips it on subsequent runs, webhooks for it are acknowledged but become no-ops. Existing data stays untouched. Un-archiving resumes sync.

Hard delete is not exposed for any source (Pluggy or manual) — it would cascade-destroy historical transactions, contradicting the "OmniFlow keeps everything forever" rule. If a user wants to disconnect a bank entirely from Pluggy, they revoke at meu.pluggy.ai (Pluggy fires `item/deleted` → handler sets `pluggy_status='disconnected'` and clears `pluggy_item_id`); the source becomes manual and historical data is retained.

## Sync flows

### Manual ("Sync from Pluggy" button)

```
1. Client → POST /functions/v1/pluggy-sync  (JWT, body: { sourceId? })
2. Edge Function:
   a. If sourceId omitted: GET /items (all items associated with the Demo App)
      → for each item not yet in OmniFlow: insert source with pluggy_item_id, name from connector
      → for each item already linked: keep existing source
   b. For each (now-linked) source: walk Pluggy data
      • Accounts: mergeAccount × N (handle CC-to-checking auto-link)
      • Investments: mergeHolding × N
      • Transactions: paginated page=1, pageSize=500, from=last_synced - 1d (or now-90d on initial)
        → mergeTransaction × N
   c. UPDATE sources SET pluggy_status='active', pluggy_last_synced_at=now()
   d. INSERT pluggy_sync_log (trigger='manual'|'initial', counts=...)
3. Returns { sourceCounts, totalCounts }
4. Client invalidates ['sources','accounts','transactions','holdings'] queries
   → toast.success("Synced 47 transactions from 2 sources")
```

### Webhook (`pluggy-webhook`)

| Event | Handler |
|---|---|
| `item/created` | No-op. Initial sync handles via "Sync from Pluggy" button. |
| `item/updated` | Refetch accounts + investments for this item. Update `pluggy_last_synced_at`. |
| `item/login_succeeded` | `UPDATE sources SET pluggy_status='active', pluggy_last_error=null`. |
| `item/error` | `UPDATE sources SET pluggy_status='login_error', pluggy_last_error=event.error`. UI shows "Reconnect at meu.pluggy" link. |
| `item/waiting_user_input` / `item/waiting_user_action` | `UPDATE sources SET pluggy_status='login_error'`. Same UX as `item/error`. |
| `item/deleted` | `UPDATE sources SET pluggy_status='disconnected', pluggy_item_id=null`. Source becomes manual; existing data stays. |
| `transactions/created` | Fetch via `event.createdTransactionsLink`. Walk pages, `mergeTransaction` each. |
| `transactions/updated` | For each `event.transactionIds`: fetch by id, `mergeTransaction`. |
| `transactions/deleted` | For each `event.transactionIds`: `UPDATE transactions SET pluggy_deleted_at=now()`. Never hard delete. |
| `connector/status_updated` | No-op. Connector-level info isn't surfaced in OmniFlow's UI. |

Webhook auth: HMAC verification against `PLUGGY_WEBHOOK_SECRET` happens before any DB read. Defense-in-depth: even after a forged-but-valid signature would somehow be produced, we still constrain every write by the `user_id` derived from `sources.pluggy_item_id = event.itemId` — a bad payload can't write to another user's data.

Each webhook invocation finishes within Pluggy's 5s SLA. For solo-user volume, synchronous merge inside the handler is fine. If we ever hit timeouts (we won't), introduce a queue table.

### Re-auth flow (login_error)

User sees red dot on the source row in Settings → Sources → "Reconnect at meu.pluggy" link → opens `https://meu.pluggy.ai` in a new tab → user re-authenticates the bank there → Pluggy fires `item/login_succeeded` to our webhook → handler clears the error → UI updates on next render.

No widget round-trip in OmniFlow.

## The merge module

One TypeScript file: `supabase/functions/_shared/pluggy-merge.ts`. Used identically by `pluggy-sync` and `pluggy-webhook`.

```ts
const TX_MERGEABLE      = ['description','category_id','type','payment_method','account_id'] as const;
const ACCOUNT_MERGEABLE = ['type','name','currency'] as const;
const HOLDING_MERGEABLE = ['ticker','name','current_price_cents','currency','notes'] as const;

const TX_BANK_TRUTH = ['amount_cents','occurred_on','currency',
                       'pluggy_status','pluggy_category','pluggy_description_raw',
                       'pluggy_balance_after_cents','pluggy_merchant_name','pluggy_merchant_category',
                       'pluggy_cc_installment','pluggy_cc_total_installments','pluggy_cc_bill_id'];

async function mergeTransaction(pluggyTx, ctx) {
  const existing = await db.from('transactions')
    .select('id, user_edited_fields, deleted_at')
    .match({ user_id: ctx.userId, pluggy_transaction_id: pluggyTx.id })
    .maybeSingle();

  if (existing?.deleted_at) return 'skipped_user_deleted';

  // Bank truth: always overwrite. user_edited_fields cannot claim these.
  const patch = mapBankTruthFields(pluggyTx);

  // Mergeable: apply only if user hasn't touched.
  for (const f of TX_MERGEABLE) {
    if (!existing || !existing.user_edited_fields.includes(f)) {
      patch[f] = await mapMergeableField(pluggyTx, f, ctx);
    }
  }

  return existing
    ? db.from('transactions').update(patch).eq('id', existing.id)
    : db.from('transactions').insert({ ...patch, user_id: ctx.userId, pluggy_transaction_id: pluggyTx.id });
}
```

**Type classification at insert** (Pluggy returns DEBIT/CREDIT, OmniFlow needs earning/expense/investment):
- account is brokerage → `'investment'`
- account is checking/savings, DEBIT → `'expense'`
- account is checking/savings, CREDIT → `'earning'`
- CC link case (Pluggy txId on a CC account, account_id resolves to its linked checking) → `payment_method='credit_card'`, `settled_at=NULL`

User can re-classify; the edit is sticky.

**CC linkage** lives inside `mapMergeableField` for `account_id` and `payment_method`: if `pluggyTx.accountId === some_checking.pluggy_cc_account_id`, route the transaction onto that checking with `payment_method='credit_card'`.

## UI surfaces

### Settings → Sources page

- One "Sync from Pluggy" button at the top, with last-sync timestamp.
- Two labeled groups: PLUGGY-MANAGED, MANUAL.
- Pluggy-managed source rows display: connector logo + name (or user-set nickname) + status dot + "synced Xm ago".
  - `active` → green dot; `⋯` menu: Sync now, Edit nickname, Archive
  - `updating` → pulsing yellow dot
  - `login_error` / `waiting_user_input` → red dot + "Reconnect at meu.pluggy" link
  - `outdated` → amber dot + "Out of date" + Sync now CTA
  - `disconnected` → grey dot, source becomes manual
- Inline accounts under each source (existing pattern from step 7), with credit cards rendered as sub-rows of the parent checking.
- Manual sources unchanged. `[+ Add manual source]` button at the bottom of the Manual group.

### Transactions table

- New `↻` icon next to description on Pluggy-imported rows. Hover: "Synced from Pluggy · last sync 4m ago".
- Same icon with a pencil overlay (`↻✎`) when `user_edited_fields` is non-empty. Hover: "Synced + edited (description, category)".
- Strikethrough + "Reversed by bank" badge for rows with `pluggy_deleted_at` set.
- Existing Method column gets one new filter chip option: "Pluggy / Manual".

### Transaction edit dialog

- Submit handler diffs the form values against the row, appends changed mergeable field names to `user_edited_fields` before update.
- Inline note above the form (only on Pluggy-imported rows): "Your edits will not be overwritten by future syncs."
- `amount`, `date` fields disabled when `pluggy_transaction_id` is set, with a "Bank-truth fields cannot be edited" tooltip.

### Account edit dialog

- Same sticky-edit pattern for `type`, `name`, `currency`. Solves the user's "Pluggy returns my brokerage as checking" complaint.

### New-transaction form

- Source picker shows two groups: "Pluggy-managed (sync only)" with disabled rows, "Manual" with selectable rows.
- Disabled-row tooltip: "This source syncs from Pluggy. Manual entry is disabled — connect via meu.pluggy if missing."
- FAB and command palette "New transaction" entries lead to the same form, same restriction.

### Settings → Data tab — Recent syncs card

Renders last 30 rows from `pluggy_sync_log`, newest first. One line per sync: `✓` or `✗`, trigger, source name, time-ago, summary counts or error message.

## Environment & secrets

Three new server-side secrets, never `VITE_*`:

| Name | Purpose |
|---|---|
| `PLUGGY_CLIENT_ID` | Demo App credential |
| `PLUGGY_CLIENT_SECRET` | Demo App credential |
| `PLUGGY_WEBHOOK_SECRET` | HMAC secret for webhook signature verification — generated by us, registered in Pluggy dashboard |

Local dev: a new `.env.functions` file (gitignored) holds these. Loaded into Edge Functions via `pnpm dlx supabase secrets set --env-file .env.functions`. Same standing authorization as migrations: Claude pushes secret updates without asking, per the existing `.env`-handling rule in CLAUDE.md.

**Webhook URL to register in the Pluggy dashboard:**
`https://<supabase-project-ref>.supabase.co/functions/v1/pluggy-webhook`

For OmniFlow's hosted project (ref `mkwncqhhnkhcznauzveq` per CLAUDE.md): `https://mkwncqhhnkhcznauzveq.supabase.co/functions/v1/pluggy-webhook`. Registered once per Pluggy app (sandbox + prod) with event filter "all".

Sandbox vs production: register two Pluggy apps (sandbox + prod), swap secrets, redeploy Edge Functions. No per-call flag. Step 7.5 ships against the sandbox app first, smoke-tests, then swaps to prod.

## Error handling

**`pluggy-sync`:**
- Pluggy 5xx / network → catch, log entry with `status='error'`, return 502 to client. Existing data untouched.
- Pluggy 429 (rate limit) → exponential backoff (1s/4s/16s, max 3 retries) inside the function. Persistent failure: log + return error.
- Per-item failure during multi-source sync → continue processing remaining items. Response body has per-source status; client surfaces partial success.

**`pluggy-webhook`:**
- HMAC mismatch → 401, no DB writes, no log row.
- Unknown event type → 200 (ack) + Edge Function log warning; no DB writes.
- `event.itemId` doesn't match any source → 200 + warning; no writes (likely a stale item from a deleted user).

**Client:**
- 502 → `toast.error("Sync failed — Pluggy didn't respond. Try again.")`. No optimistic state to roll back.
- 200 partial → `toast.warn("Synced 2 of 3 sources. BTG: re-authentication required.")` + link to sync log.
- 200 full → `toast.success` + invalidate query keys.

## Idempotency

Every merge is keyed by `(user_id, pluggy_*_id)` unique indexes. Pluggy retrying a webhook 9× is safe — second through ninth invocations update instead of inserting. Re-running an entire `pluggy-sync` produces zero duplicates.

## Verification (pre-commit smoke checklist for the implementation step)

Pre-commit checks: `pnpm typecheck` + `pnpm build` green. Then in-browser against the sandbox Pluggy app:

1. Connect a sandbox bank at meu.pluggy (sandbox env) → appears in Demo App.
2. Click "Sync from Pluggy" in OmniFlow → source + accounts + transactions + holdings appear; toast shows correct counts.
3. Edit a transaction's category → re-trigger sync → category survives.
4. Edit an account's `type` (mis-classified by Pluggy) → re-trigger sync → type survives.
5. Soft-delete a transaction → trigger sync → row is NOT resurrected.
6. Trigger sandbox `transactions/created` from Pluggy dashboard test tool → webhook handler fires → new row appears in OmniFlow without page reload.
7. Trigger sandbox `item/error` → source row shows red dot + "Reconnect at meu.pluggy" link.
8. Trigger sandbox `transactions/deleted` → row gets `pluggy_deleted_at`, renders strikethrough + "Reversed by bank" badge.
9. Open new-transaction form → Pluggy-managed sources are disabled with the documented tooltip.
10. Sources page Recent syncs card shows entries for each of the above operations.

After sandbox passes: register a production Pluggy app, swap secrets, redeploy Edge Functions, repeat the same smoke checklist against real Nubank + BTG items.

## Implementation TBDs (resolve at code time, not now)

- **Exact HMAC header name + algorithm Pluggy uses to sign webhook bodies.** Pluggy docs page on signature verification 404'd at design time. Resolve by reading `pluggy-sdk` source or asking Pluggy support during implementation. If signing isn't enforced at the API level, fall back to a long shared-secret query parameter.
- **Whether `clientId/clientSecret` alone is enough to call `GET /items` for items shared via Data Passport**, or whether an additional user-bound token exchange is required. Strongly implied yes (the user's dashboard already shows the items under their app), but verify with a live `curl` before locking the Edge Function code.
- **Pluggy SDK Deno compatibility.** `npm:pluggy-sdk` import in Edge Functions is the path of least resistance, but if the SDK has Node-only dependencies (e.g., uses Node's `crypto` module in a way Deno doesn't polyfill), fall back to direct `fetch` against Pluggy's REST API. Both approaches produce identical behavior; this is a code-level detail.

## Out of scope (intentional)

- **Connect Widget in OmniFlow** (Tier 2 from brainstorming). Deferred to 7.5b if/when needed.
- **"Load older history"** (older than 90 days on initial connect). Deferred. Webhooks fill in everything from the cut forward.
- **Cross-bank transfer auto-detection.** Manual fix path only via sticky edits + soft delete.
- **Pluggy Identity / Loans / Payments endpoints.** Never in scope. Read-only by mandate.
- **Multi-user.** OmniFlow is solo-user by design.
- **i18n on Pluggy-imported strings.** Bank-typed descriptions stay in whatever language the bank returned; OmniFlow chrome stays English.

## Step renumbering downstream

Migrations 008 (recurring rules) and 009 (budgets) keep their numbers. The previously-planned 007 (holdings-only) becomes part of the combined `007_pluggy_and_holdings.sql`. Step 8 (Investments page) shrinks to UI-only — the holdings table and `holding_id` column already exist.

## Roadmap insertion

In `CLAUDE.md` `## Roadmap`:
```
- [x] **Step 7** — Categories page + sources / payment-methods / credit-card overhaul
- [ ] **Step 7.5** — Pluggy Open Finance integration (migration 007 + Edge Functions)
- [ ] **Step 8** — Investments page (UI-only — holdings already exist)
- [ ] **Step 9** — …
```

Step 7.5 is the next active step. After approval of this spec, we move to writing the implementation plan via `superpowers:writing-plans`.
