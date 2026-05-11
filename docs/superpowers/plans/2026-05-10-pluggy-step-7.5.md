# Step 7.5 — Pluggy Open Finance Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fetch financial data from the user's banks via Pluggy (read-only), preserving manual entry for institutions Pluggy doesn't cover, with sticky user edits and forever-retention.

**Architecture:** Two Supabase Edge Functions (`pluggy-sync`, `pluggy-webhook`) share a `_shared/pluggy-merge.ts` module that handles upserts respecting `user_edited_fields`. Items are managed externally at meu.pluggy.ai (Pattern B / Data Passport); OmniFlow only consumes via API. No widget in 7.5.

**Tech Stack:** Postgres (Supabase) + Deno (Edge Functions) + `npm:pluggy-sdk` + React/TypeScript client (existing).

**Spec:** `docs/superpowers/specs/2026-05-10-pluggy-step-7.5-design.md` is the source of truth. This plan executes the spec.

**Authoritative reference for next-session pickup:** This file. CLAUDE.md `## Status` section will be updated mid-step if a session limit hits before completion.

---

## Pre-flight (do once before starting Phase A)

These are USER ACTIONS — Claude can guide but cannot execute, since they require the Pluggy dashboard.

- [ ] **Pre-flight 1:** In the Pluggy developer dashboard, open the "Pluggy Demo App" (Development environment). Copy the `Client ID` and click the eye icon to reveal `Client Secret`. Keep this tab open.
- [ ] **Pre-flight 2:** In the same dashboard, scroll to "Webhooks" and click "Add Webhook". URL field: leave empty for now (we'll set it after Edge Function deploy in Phase C). Don't save yet.
- [ ] **Pre-flight 3:** Generate a webhook signing secret locally — any 32-byte random string. Run in PowerShell: `[Convert]::ToBase64String((1..32 | %{[byte](Get-Random -Maximum 256)}))` and copy the output. (Pluggy's dashboard does not auto-generate this; we provide it during webhook registration.)

After these three steps you have: `clientId`, `clientSecret`, `webhookSecret` (locally) ready for Phase C step C5.

---

## Phase A — Schema (migration 007)

### Task A1: Write migration `007_pluggy_and_holdings.sql`

**Files:**
- Create: `supabase/migrations/007_pluggy_and_holdings.sql`

- [ ] **Step 1: Create the migration file with full SQL**

```sql
-- 007_pluggy_and_holdings.sql
-- Combines Pluggy integration columns with the holdings table from previously-planned step 8.
-- See docs/superpowers/specs/2026-05-10-pluggy-step-7.5-design.md for design rationale.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. SOURCES — Pluggy linkage columns
-- ─────────────────────────────────────────────────────────────────────────
alter table sources add column pluggy_item_id        text;
alter table sources add column pluggy_connector_id   integer;
alter table sources add column pluggy_status         text check (pluggy_status in
  ('active','login_error','updating','outdated','disconnected'));
alter table sources add column pluggy_last_synced_at timestamptz;
alter table sources add column pluggy_last_error     jsonb;

create unique index sources_pluggy_item_uniq
  on sources(user_id, pluggy_item_id) where pluggy_item_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTS — Pluggy linkage + sticky-edit tracking
-- ─────────────────────────────────────────────────────────────────────────
alter table accounts add column pluggy_account_id       text;
alter table accounts add column pluggy_cc_account_id    text;
alter table accounts add column pluggy_subtype          text;
alter table accounts add column pluggy_owner            text;
alter table accounts add column pluggy_marketing_name   text;
alter table accounts add column pluggy_available_credit_cents bigint;
alter table accounts add column pluggy_balance_due_date    date;
alter table accounts add column pluggy_balance_close_date  date;
alter table accounts add column pluggy_cc_brand            text;
alter table accounts add column user_edited_fields         text[] not null default '{}';

create unique index accounts_pluggy_account_uniq
  on accounts(user_id, pluggy_account_id) where pluggy_account_id is not null;
create unique index accounts_pluggy_cc_uniq
  on accounts(user_id, pluggy_cc_account_id) where pluggy_cc_account_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. HOLDINGS — new table (must precede transactions alter for FK below)
-- ─────────────────────────────────────────────────────────────────────────
create table holdings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  account_id               uuid not null references accounts(id)   on delete cascade,
  ticker                   text,
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
  pluggy_rate              numeric(8,4),
  pluggy_rate_type         text,
  pluggy_last_12m_rate     numeric(8,4),
  pluggy_due_date          date,
  user_edited_fields       text[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table holdings enable row level security;
create policy "holdings_owner" on holdings using (auth.uid() = user_id);

create unique index holdings_pluggy_investment_uniq
  on holdings(user_id, pluggy_investment_id) where pluggy_investment_id is not null;

create trigger holdings_set_updated_at
  before update on holdings
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. TRANSACTIONS — Pluggy linkage + sticky-edit + holding_id FK
-- ─────────────────────────────────────────────────────────────────────────
alter table transactions add column pluggy_transaction_id    text;
alter table transactions add column pluggy_status            text check (pluggy_status in ('PENDING','POSTED'));
alter table transactions add column pluggy_category          text;
alter table transactions add column pluggy_description_raw   text;
alter table transactions add column pluggy_provider_code     text;
alter table transactions add column pluggy_balance_after_cents bigint;
alter table transactions add column pluggy_merchant_name     text;
alter table transactions add column pluggy_merchant_category text;
alter table transactions add column pluggy_cc_installment    int;
alter table transactions add column pluggy_cc_total_installments int;
alter table transactions add column pluggy_cc_bill_id        text;
alter table transactions add column pluggy_deleted_at        timestamptz;
alter table transactions add column user_edited_fields       text[] not null default '{}';
alter table transactions add column holding_id               uuid references holdings(id) on delete set null;

create unique index transactions_pluggy_uniq
  on transactions(user_id, pluggy_transaction_id) where pluggy_transaction_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. PLUGGY_SYNC_LOG — debugging audit trail
-- ─────────────────────────────────────────────────────────────────────────
create table pluggy_sync_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source_id     uuid references sources(id) on delete cascade,
  trigger       text not null check (trigger in ('manual','webhook','initial','reconnect')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  status        text not null check (status in ('running','ok','error')),
  counts        jsonb,
  error_message text
);

alter table pluggy_sync_log enable row level security;
create policy "sync_log_owner" on pluggy_sync_log using (auth.uid() = user_id);
```

- [ ] **Step 2: Verify the SQL is syntactically clean**

Run: `pnpm dlx supabase db lint -f supabase/migrations/007_pluggy_and_holdings.sql 2>&1 || echo "lint not available — skip"`

Expected: no syntax errors. (`db lint` may not exist on every CLI version; if missing, proceed — `db push` will surface errors.)

### Task A2: Apply migration to hosted Supabase

- [ ] **Step 1: Read credentials from .env**

Run in PowerShell:
```powershell
$envFile = Get-Content .env
$token  = ($envFile | Where-Object { $_ -match "^SUPABASE_TOKEN=" })       -replace "^SUPABASE_TOKEN=", ""
$dbpass = ($envFile | Where-Object { $_ -match "^SUPABASE_DB_PASSWORD=" }) -replace "^SUPABASE_DB_PASSWORD=", ""
$env:SUPABASE_ACCESS_TOKEN = $token
$env:SUPABASE_DB_PASSWORD  = $dbpass
```

Expected: no output. `$env:SUPABASE_ACCESS_TOKEN` and `$env:SUPABASE_DB_PASSWORD` are now set in the current shell.

- [ ] **Step 2: Push the migration**

Run: `pnpm dlx supabase db push --password $env:SUPABASE_DB_PASSWORD`

Expected output ends with `Finished supabase db push` and lists `007_pluggy_and_holdings.sql` as applied.

- [ ] **Step 3: Confirm the migration list shows 007 applied locally and remotely**

Run: `pnpm dlx supabase migration list --password $env:SUPABASE_DB_PASSWORD`

Expected: a row for `007_pluggy_and_holdings` with both `Local` and `Remote` columns populated with the same timestamp.

### Task A3: Update Zod schemas for new columns

**Files:**
- Modify: `src/features/sources/schemas.ts`
- Modify: `src/features/accounts/schemas.ts`
- Modify: `src/features/transactions/schemas.ts`
- Create: `src/features/holdings/schemas.ts`

- [ ] **Step 1: Update `src/features/sources/schemas.ts` — add Pluggy fields**

Add to the existing `SourceSchema` (preserve existing fields):

```ts
export const SourceSchema = z.object({
  // ... existing fields ...
  pluggy_item_id:        z.string().nullable(),
  pluggy_connector_id:   z.number().int().nullable(),
  pluggy_status:         z.enum(['active','login_error','updating','outdated','disconnected']).nullable(),
  pluggy_last_synced_at: z.string().nullable(),
  pluggy_last_error:     z.unknown().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export function isPluggyManaged(source: Source): boolean {
  return source.pluggy_item_id !== null;
}
```

- [ ] **Step 2: Update `src/features/accounts/schemas.ts` — add Pluggy + sticky fields**

```ts
export const AccountSchema = z.object({
  // ... existing fields ...
  pluggy_account_id:    z.string().nullable(),
  pluggy_cc_account_id: z.string().nullable(),
  pluggy_subtype:       z.string().nullable(),
  pluggy_owner:         z.string().nullable(),
  pluggy_marketing_name: z.string().nullable(),
  pluggy_available_credit_cents: z.number().nullable(),
  pluggy_balance_due_date:    z.string().nullable(),
  pluggy_balance_close_date:  z.string().nullable(),
  pluggy_cc_brand:            z.string().nullable(),
  user_edited_fields:         z.array(z.string()).default([]),
});
```

- [ ] **Step 3: Update `src/features/transactions/schemas.ts` — add Pluggy + sticky fields + holding_id**

```ts
export const TransactionSchema = z.object({
  // ... existing fields ...
  pluggy_transaction_id:        z.string().nullable(),
  pluggy_status:                z.enum(['PENDING','POSTED']).nullable(),
  pluggy_category:              z.string().nullable(),
  pluggy_description_raw:       z.string().nullable(),
  pluggy_provider_code:         z.string().nullable(),
  pluggy_balance_after_cents:   z.number().nullable(),
  pluggy_merchant_name:         z.string().nullable(),
  pluggy_merchant_category:     z.string().nullable(),
  pluggy_cc_installment:        z.number().int().nullable(),
  pluggy_cc_total_installments: z.number().int().nullable(),
  pluggy_cc_bill_id:            z.string().nullable(),
  pluggy_deleted_at:            z.string().nullable(),
  user_edited_fields:           z.array(z.string()).default([]),
  holding_id:                   z.string().uuid().nullable(),
});
```

- [ ] **Step 4: Create `src/features/holdings/schemas.ts`**

```ts
import { z } from 'zod';

export const HoldingSchema = z.object({
  id:                  z.string().uuid(),
  user_id:             z.string().uuid(),
  account_id:          z.string().uuid(),
  ticker:              z.string().nullable(),
  name:                z.string(),
  shares:              z.number(),
  avg_cost_cents:      z.number().int(),
  current_price_cents: z.number().int(),
  currency:            z.string(),
  notes:               z.string().nullable(),
  pluggy_investment_id:    z.string().nullable(),
  pluggy_status:           z.enum(['ACTIVE','PENDING','TOTAL_WITHDRAWAL']).nullable(),
  pluggy_isin:             z.string().nullable(),
  pluggy_issuer:           z.string().nullable(),
  pluggy_amount_profit_cents: z.number().int().nullable(),
  pluggy_taxes_cents:      z.number().int().nullable(),
  pluggy_rate:             z.number().nullable(),
  pluggy_rate_type:        z.string().nullable(),
  pluggy_last_12m_rate:    z.number().nullable(),
  pluggy_due_date:         z.string().nullable(),
  user_edited_fields:      z.array(z.string()).default([]),
  created_at:              z.string(),
  updated_at:              z.string(),
});
export type Holding = z.infer<typeof HoldingSchema>;
```

### Task A4: Verify typecheck and build are green

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: zero errors.

If errors surface (likely places that destructure existing schemas without the new fields), surface to user — don't blanket-fix without context.

- [ ] **Step 2: Run build**

Run: `pnpm build`

Expected: build succeeds.

### Task A5: Commit Phase A

- [ ] **Step 1: Stage and commit**

Run:
```powershell
git add supabase/migrations/007_pluggy_and_holdings.sql `
        src/features/sources/schemas.ts `
        src/features/accounts/schemas.ts `
        src/features/transactions/schemas.ts `
        src/features/holdings/schemas.ts
git commit -m @'
Step 7.5 phase A: migration 007 + zod schemas

Lands the Pluggy linkage columns, sticky-edit tracking, holdings table,
and pluggy_sync_log audit trail. Zod schemas updated to match. No app
code uses the new fields yet — that lands in subsequent phases.
'@
```

Expected: commit succeeds, working tree clean.

---

## Phase B — Merge module (TDD)

### Task B1: Set up Edge Function project structure

**Files:**
- Create: `supabase/functions/_shared/pluggy-merge.ts` (skeleton)
- Create: `supabase/functions/_shared/pluggy-merge.test.ts`
- Create: `supabase/functions/_shared/types.ts`
- Create: `supabase/functions/import_map.json`
- Modify: `.gitignore` (add `.env.functions`)

- [ ] **Step 1: Create `supabase/functions/import_map.json`**

```json
{
  "imports": {
    "pluggy-sdk": "npm:pluggy-sdk@1.0.0",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

(Pluggy SDK version: pin to whatever `npm view pluggy-sdk version` returns when running this task. The `1.0.0` above is illustrative.)

- [ ] **Step 2: Create `supabase/functions/_shared/types.ts`**

```ts
export interface MergeContext {
  userId: string;
  sourceId: string;
  sb: SupabaseClient;  // service-role client
}

export type MergeResult =
  | { kind: 'inserted', id: string }
  | { kind: 'updated',  id: string }
  | { kind: 'skipped_user_deleted' }
  | { kind: 'skipped_no_account' };

import type { SupabaseClient } from '@supabase/supabase-js';
```

- [ ] **Step 3: Create `supabase/functions/_shared/pluggy-merge.ts` skeleton (functions stub-only — they will fail tests until implemented)**

```ts
import type { MergeContext, MergeResult } from './types.ts';

export const TX_MERGEABLE      = ['description','category_id','type','payment_method','account_id'] as const;
export const ACCOUNT_MERGEABLE = ['type','name','currency'] as const;
export const HOLDING_MERGEABLE = ['ticker','name','current_price_cents','currency','notes'] as const;

export async function mergeTransaction(_pluggyTx: unknown, _ctx: MergeContext): Promise<MergeResult> {
  throw new Error('not implemented');
}

export async function mergeAccount(_pluggyAcc: unknown, _ctx: MergeContext): Promise<MergeResult> {
  throw new Error('not implemented');
}

export async function mergeHolding(_pluggyInv: unknown, _ctx: MergeContext): Promise<MergeResult> {
  throw new Error('not implemented');
}

export async function mergeSource(_pluggyItem: unknown, _userId: string): Promise<MergeResult> {
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Add `.env.functions` to `.gitignore`**

Append the following line to `.gitignore`:

```
.env.functions
```

### Task B2: TDD — `mergeTransaction` sticky-edit behavior

**Files:**
- Modify: `supabase/functions/_shared/pluggy-merge.test.ts`
- Modify: `supabase/functions/_shared/pluggy-merge.ts`

- [ ] **Step 1: Write the failing test for "new tx → insert with full Pluggy payload"**

Create `supabase/functions/_shared/pluggy-merge.test.ts`:

```ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { mergeTransaction } from "./pluggy-merge.ts";
import { makeMockCtx, makeMockPluggyTx } from "./_test-helpers.ts";

Deno.test("mergeTransaction inserts new row with full Pluggy payload", async () => {
  const ctx = makeMockCtx({ existingRows: [] });
  const pluggyTx = makeMockPluggyTx({
    id: 'plg_abc',
    accountId: 'plg_acc_1',
    amount: -42.50,                  // DEBIT
    date: '2026-04-01T00:00:00Z',
    description: 'Coffee',
    currencyCode: 'BRL',
    type: 'DEBIT',
    status: 'POSTED',
    category: 'Food & Drinks',
  });
  const result = await mergeTransaction(pluggyTx, ctx);
  assertEquals(result.kind, 'inserted');
  const inserted = ctx.sb.tracked.transactions.inserts[0];
  assertEquals(inserted.pluggy_transaction_id, 'plg_abc');
  assertEquals(inserted.amount_cents, -4250);
  assertEquals(inserted.occurred_on, '2026-04-01');
  assertEquals(inserted.description, 'Coffee');
  assertEquals(inserted.type, 'expense');                  // DEBIT on checking → expense
  assertEquals(inserted.pluggy_category, 'Food & Drinks');
  assertEquals(inserted.user_edited_fields, []);
});
```

Also create `supabase/functions/_shared/_test-helpers.ts` with `makeMockCtx` and `makeMockPluggyTx`. Mock context exposes `ctx.sb.tracked.{table}.inserts` / `updates` arrays for assertions, and `ctx.sb.tracked.{table}.existing` for setup.

```ts
// _test-helpers.ts
export function makeMockCtx(opts: { existingRows: unknown[] }): MergeContext {
  // returns a context with a fake SupabaseClient that records insert/update calls
  // and returns rows from opts.existingRows on .select().match() lookups.
  // Implementation: a minimal in-memory shim — ~80 LOC.
  // ...
}

export function makeMockPluggyTx(overrides: Partial<PluggyTx> = {}): PluggyTx {
  return {
    id: 'plg_default',
    accountId: 'plg_acc_default',
    amount: 0,
    date: '2026-01-01T00:00:00Z',
    description: 'test',
    currencyCode: 'BRL',
    type: 'DEBIT',
    status: 'POSTED',
    ...overrides,
  };
}
```

(Full helper implementations are part of this step — write the in-memory Supabase shim in ~80 lines. The shim only needs to support `.from(table).select().match().maybeSingle()`, `.insert()`, `.update().eq()` — the four operations the merge module uses.)

- [ ] **Step 2: Run the test, confirm it fails**

Run: `cd supabase/functions && deno test _shared/pluggy-merge.test.ts --allow-all`

Expected: FAIL with `Error: not implemented`.

- [ ] **Step 3: Implement `mergeTransaction` minimally to pass**

Replace the stub in `supabase/functions/_shared/pluggy-merge.ts`:

```ts
import { TX_MERGEABLE } from './pluggy-merge.ts';
import type { MergeContext, MergeResult } from './types.ts';

const TX_BANK_TRUTH = ['amount_cents','occurred_on','currency',
                       'pluggy_status','pluggy_category','pluggy_description_raw',
                       'pluggy_balance_after_cents','pluggy_merchant_name','pluggy_merchant_category',
                       'pluggy_cc_installment','pluggy_cc_total_installments','pluggy_cc_bill_id'];

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function classifyType(account: { type: string }, pluggyType: 'DEBIT'|'CREDIT'): string {
  if (account.type === 'brokerage') return 'investment';
  return pluggyType === 'DEBIT' ? 'expense' : 'earning';
}

export async function mergeTransaction(pluggyTx: any, ctx: MergeContext): Promise<MergeResult> {
  const { data: existing } = await ctx.sb.from('transactions')
    .select('id, user_edited_fields, deleted_at, account_id')
    .match({ user_id: ctx.userId, pluggy_transaction_id: pluggyTx.id })
    .maybeSingle();

  if (existing?.deleted_at) return { kind: 'skipped_user_deleted' };

  const account = await resolveAccount(pluggyTx.accountId, ctx);
  if (!account) return { kind: 'skipped_no_account' };

  const patch: Record<string, unknown> = {
    amount_cents: toCents(pluggyTx.amount),
    occurred_on: pluggyTx.date.split('T')[0],
    currency: pluggyTx.currencyCode,
    pluggy_status: pluggyTx.status,
    pluggy_category: pluggyTx.category ?? null,
    pluggy_description_raw: pluggyTx.descriptionRaw ?? null,
    pluggy_balance_after_cents: pluggyTx.balance != null ? toCents(pluggyTx.balance) : null,
    pluggy_merchant_name: pluggyTx.merchant?.name ?? null,
    pluggy_merchant_category: pluggyTx.merchant?.category ?? null,
    pluggy_cc_installment: pluggyTx.creditCardMetadata?.installmentNumber ?? null,
    pluggy_cc_total_installments: pluggyTx.creditCardMetadata?.totalInstallments ?? null,
    pluggy_cc_bill_id: pluggyTx.creditCardMetadata?.billId ?? null,
  };

  const editedFields = existing?.user_edited_fields ?? [];
  for (const f of TX_MERGEABLE) {
    if (editedFields.includes(f)) continue;
    if (f === 'description')      patch[f] = pluggyTx.description;
    else if (f === 'type')        patch[f] = classifyType(account, pluggyTx.type);
    else if (f === 'account_id')  patch[f] = account.id;
    else if (f === 'payment_method') patch[f] = account.is_cc_link ? 'credit_card' : null;
    else if (f === 'category_id') patch[f] = null;  // initial import never auto-assigns category
  }

  if (existing) {
    await ctx.sb.from('transactions').update(patch).eq('id', existing.id);
    return { kind: 'updated', id: existing.id };
  }
  const { data: inserted } = await ctx.sb.from('transactions').insert({
    ...patch,
    user_id: ctx.userId,
    pluggy_transaction_id: pluggyTx.id,
    user_edited_fields: [],
  }).select('id').single();
  return { kind: 'inserted', id: inserted!.id };
}

async function resolveAccount(pluggyAccountId: string, ctx: MergeContext) {
  // Look up OmniFlow account by either pluggy_account_id or pluggy_cc_account_id
  const { data: matches } = await ctx.sb.from('accounts')
    .select('id, type, pluggy_account_id, pluggy_cc_account_id')
    .eq('user_id', ctx.userId)
    .or(`pluggy_account_id.eq.${pluggyAccountId},pluggy_cc_account_id.eq.${pluggyAccountId}`);
  if (!matches?.length) return null;
  const acc = matches[0];
  return { id: acc.id, type: acc.type, is_cc_link: acc.pluggy_cc_account_id === pluggyAccountId };
}
```

- [ ] **Step 4: Run the test, confirm it passes**

Run: `cd supabase/functions && deno test _shared/pluggy-merge.test.ts --allow-all`

Expected: PASS for `mergeTransaction inserts new row with full Pluggy payload`.

- [ ] **Step 5: Add the sticky-edit test**

Append to `pluggy-merge.test.ts`:

```ts
Deno.test("mergeTransaction respects user_edited_fields on update", async () => {
  const existing = {
    id: 'existing_1',
    user_id: 'u1',
    pluggy_transaction_id: 'plg_abc',
    description: 'My custom description',
    category_id: 'cat_user',
    user_edited_fields: ['description', 'category_id'],
    deleted_at: null,
    account_id: 'omf_acc_1',
  };
  const ctx = makeMockCtx({ existingRows: [existing] });
  const pluggyTx = makeMockPluggyTx({
    id: 'plg_abc',
    description: 'Pluggy says different',  // user kept their edit
    category: 'Food & Drinks',
  });
  const result = await mergeTransaction(pluggyTx, ctx);
  assertEquals(result.kind, 'updated');
  const update = ctx.sb.tracked.transactions.updates[0];
  // Bank-truth fields ARE updated:
  assertEquals(update.amount_cents !== undefined, true);
  assertEquals(update.pluggy_category, 'Food & Drinks');
  // User-edited fields are NOT in the update patch:
  assertEquals('description' in update, false);
  assertEquals('category_id' in update, false);
});

Deno.test("mergeTransaction skips soft-deleted rows", async () => {
  const existing = {
    id: 'deleted_1',
    pluggy_transaction_id: 'plg_xyz',
    user_edited_fields: [],
    deleted_at: '2026-04-15T10:00:00Z',
  };
  const ctx = makeMockCtx({ existingRows: [existing] });
  const pluggyTx = makeMockPluggyTx({ id: 'plg_xyz' });
  const result = await mergeTransaction(pluggyTx, ctx);
  assertEquals(result.kind, 'skipped_user_deleted');
  assertEquals(ctx.sb.tracked.transactions.updates.length, 0);
});
```

- [ ] **Step 6: Run all transaction tests, confirm they pass**

Run: `cd supabase/functions && deno test _shared/pluggy-merge.test.ts --allow-all -- --filter "mergeTransaction"`

Expected: 3 PASS.

### Task B3: TDD — `mergeAccount` with CC auto-link

- [ ] **Step 1: Write the failing test for "new account inserted with Pluggy fields"**

Append to `pluggy-merge.test.ts`:

```ts
Deno.test("mergeAccount inserts checking with credit_limit when Pluggy returns CREDIT subtype", async () => {
  const ctx = makeMockCtx({ existingRows: [] });
  const pluggyAcc = {
    id: 'plg_acc_cc',
    itemId: 'plg_item_1',
    type: 'CREDIT',
    subtype: 'CREDIT_CARD',
    name: 'gold 1697',
    balance: 8361.56,
    currencyCode: 'BRL',
    creditData: {
      creditLimit: 12000,
      availableCreditLimit: 3638.44,
      brand: 'Mastercard',
      balanceDueDate: '2026-05-15',
      balanceCloseDate: '2026-05-08',
    },
  };
  const result = await mergeAccount(pluggyAcc, { ...ctx, sourceId: 'omf_src_1' });
  // CC accounts in Pluggy do NOT create an OmniFlow account directly —
  // they auto-link to the sibling checking under the same source.
  // For this test, no checking exists yet → it should auto-create a shadow.
  assertEquals(result.kind, 'inserted');
  const inserted = ctx.sb.tracked.accounts.inserts[0];
  assertEquals(inserted.type, 'checking');
  assertEquals(inserted.credit_limit_cents, 1200000);
  assertEquals(inserted.pluggy_cc_account_id, 'plg_acc_cc');
  assertEquals(inserted.pluggy_cc_brand, 'Mastercard');
  assertEquals(inserted.opening_balance_cents, 0);  // shadow checking
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd supabase/functions && deno test _shared/pluggy-merge.test.ts --allow-all -- --filter "mergeAccount"`

Expected: FAIL — not implemented.

- [ ] **Step 3: Implement `mergeAccount`**

Replace the stub in `pluggy-merge.ts`:

```ts
export async function mergeAccount(pluggyAcc: any, ctx: MergeContext): Promise<MergeResult> {
  if (pluggyAcc.type === 'CREDIT' && pluggyAcc.subtype === 'CREDIT_CARD') {
    return await mergeCreditCard(pluggyAcc, ctx);
  }
  return await mergeBankAccount(pluggyAcc, ctx);
}

async function mergeBankAccount(pluggyAcc: any, ctx: MergeContext): Promise<MergeResult> {
  const { data: existing } = await ctx.sb.from('accounts')
    .select('id, user_edited_fields')
    .match({ user_id: ctx.userId, pluggy_account_id: pluggyAcc.id })
    .maybeSingle();

  const subtypeMap: Record<string,string> = {
    'CHECKING_ACCOUNT': 'checking',
    'SAVINGS_ACCOUNT':  'savings',
  };

  const patch: Record<string, unknown> = {
    pluggy_subtype:        pluggyAcc.subtype,
    pluggy_owner:          pluggyAcc.owner ?? null,
    pluggy_marketing_name: pluggyAcc.marketingName ?? null,
    opening_balance_cents: existing ? undefined : Math.round((pluggyAcc.balance ?? 0) * 100),
    currency:              pluggyAcc.currencyCode,
  };

  const edited = existing?.user_edited_fields ?? [];
  for (const f of ACCOUNT_MERGEABLE) {
    if (edited.includes(f)) continue;
    if (f === 'type') patch[f] = subtypeMap[pluggyAcc.subtype] ?? 'checking';
    else if (f === 'name') patch[f] = pluggyAcc.marketingName ?? pluggyAcc.name;
    else if (f === 'currency') patch[f] = pluggyAcc.currencyCode;
  }

  if (existing) {
    await ctx.sb.from('accounts').update(patch).eq('id', existing.id);
    return { kind: 'updated', id: existing.id };
  }
  const { data: inserted } = await ctx.sb.from('accounts').insert({
    ...patch,
    user_id: ctx.userId,
    source_id: ctx.sourceId,
    pluggy_account_id: pluggyAcc.id,
    user_edited_fields: [],
  }).select('id').single();
  return { kind: 'inserted', id: inserted!.id };
}

async function mergeCreditCard(pluggyAcc: any, ctx: MergeContext): Promise<MergeResult> {
  // Find existing checking under same source
  const { data: checkings } = await ctx.sb.from('accounts')
    .select('id, opening_balance_cents, user_edited_fields, pluggy_cc_account_id')
    .eq('user_id', ctx.userId)
    .eq('source_id', ctx.sourceId)
    .eq('type', 'checking')
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  const ccPatch = {
    credit_limit_cents:   Math.round((pluggyAcc.creditData?.creditLimit ?? 0) * 100),
    pluggy_cc_account_id: pluggyAcc.id,
    pluggy_cc_brand:      pluggyAcc.creditData?.brand ?? null,
    pluggy_balance_due_date:   pluggyAcc.creditData?.balanceDueDate ?? null,
    pluggy_balance_close_date: pluggyAcc.creditData?.balanceCloseDate ?? null,
    pluggy_available_credit_cents:
      pluggyAcc.creditData?.availableCreditLimit != null
        ? Math.round(pluggyAcc.creditData.availableCreditLimit * 100)
        : null,
  };

  if (checkings && checkings.length > 0) {
    // Already linked? update it. Otherwise link to first checking that has no CC yet, else first checking.
    const alreadyLinked = checkings.find(c => c.pluggy_cc_account_id === pluggyAcc.id);
    const target = alreadyLinked
      ?? checkings.find(c => !c.pluggy_cc_account_id)
      ?? checkings[0];
    await ctx.sb.from('accounts').update(ccPatch).eq('id', target.id);
    return { kind: 'updated', id: target.id };
  }

  // No checking → shadow checking
  const { data: shadow } = await ctx.sb.from('accounts').insert({
    ...ccPatch,
    user_id: ctx.userId,
    source_id: ctx.sourceId,
    type: 'checking',
    name: `${pluggyAcc.name ?? 'Card'} (carrier)`,
    currency: pluggyAcc.currencyCode,
    opening_balance_cents: 0,
    user_edited_fields: [],
  }).select('id').single();
  return { kind: 'inserted', id: shadow!.id };
}
```

- [ ] **Step 4: Run the CC test, confirm pass**

Run: `cd supabase/functions && deno test _shared/pluggy-merge.test.ts --allow-all -- --filter "mergeAccount"`

Expected: PASS.

- [ ] **Step 5: Add tests for: bank account upsert, sticky edits on type, multiple-checking selection**

Append three more test cases following the patterns in step 1. Each adds an existing-rows fixture and asserts the expected patch shape. Run tests after each to confirm green.

### Task B4: TDD — `mergeHolding`

- [ ] **Step 1: Write failing test for new holding insert**

Append:

```ts
Deno.test("mergeHolding inserts new holding with Pluggy fixed-income fields", async () => {
  const ctx = makeMockCtx({ existingRows: [] });
  const pluggyInv = {
    id: 'plg_inv_1',
    name: 'CDB Inter Daily',
    type: 'FIXED_INCOME',
    balance: 5000,
    quantity: null,
    amount: 4900,
    amountProfit: 100,
    rate: 1.05,
    rateType: 'CDI',
    lastTwelveMonthsRate: 12.4,
    issuer: 'Banco Inter',
    dueDate: '2027-12-31',
    status: 'ACTIVE',
  };
  const result = await mergeHolding(pluggyInv, { ...ctx, sourceId: 'omf_src_1' });
  assertEquals(result.kind, 'inserted');
  const inserted = ctx.sb.tracked.holdings.inserts[0];
  assertEquals(inserted.name, 'CDB Inter Daily');
  assertEquals(inserted.current_price_cents, 500000);
  assertEquals(inserted.pluggy_rate_type, 'CDI');
  assertEquals(inserted.pluggy_due_date, '2027-12-31');
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `deno test ... --filter "mergeHolding"` → FAIL.

- [ ] **Step 3: Implement `mergeHolding`** — same shape as `mergeAccount`. Resolve the parent brokerage account by `pluggyInv.itemId → source → first brokerage account under that source`. Map: `balance → current_price_cents`, `quantity → shares` (or 1 for fixed-income), `amount → avg_cost_cents`. Sticky-respect `HOLDING_MERGEABLE`.

```ts
export async function mergeHolding(pluggyInv: any, ctx: MergeContext): Promise<MergeResult> {
  // Find brokerage account under this source
  const { data: brokerages } = await ctx.sb.from('accounts')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('source_id', ctx.sourceId)
    .eq('type', 'brokerage')
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (!brokerages?.length) return { kind: 'skipped_no_account' };
  const accountId = brokerages[0].id;

  const { data: existing } = await ctx.sb.from('holdings')
    .select('id, user_edited_fields')
    .match({ user_id: ctx.userId, pluggy_investment_id: pluggyInv.id })
    .maybeSingle();

  const patch: Record<string, unknown> = {
    pluggy_status: pluggyInv.status,
    pluggy_isin: pluggyInv.isin ?? null,
    pluggy_issuer: pluggyInv.issuer ?? null,
    pluggy_amount_profit_cents: pluggyInv.amountProfit != null ? Math.round(pluggyInv.amountProfit * 100) : null,
    pluggy_taxes_cents: pluggyInv.taxes != null ? Math.round(pluggyInv.taxes * 100) : null,
    pluggy_rate: pluggyInv.rate ?? null,
    pluggy_rate_type: pluggyInv.rateType ?? null,
    pluggy_last_12m_rate: pluggyInv.lastTwelveMonthsRate ?? null,
    pluggy_due_date: pluggyInv.dueDate ?? null,
  };
  const edited = existing?.user_edited_fields ?? [];
  for (const f of HOLDING_MERGEABLE) {
    if (edited.includes(f)) continue;
    if (f === 'name') patch[f] = pluggyInv.name;
    else if (f === 'ticker') patch[f] = pluggyInv.code ?? null;
    else if (f === 'current_price_cents') patch[f] = pluggyInv.balance != null ? Math.round(pluggyInv.balance * 100) : 0;
    else if (f === 'currency') patch[f] = pluggyInv.currencyCode ?? 'BRL';
    else if (f === 'notes') patch[f] = null;
  }

  if (existing) {
    await ctx.sb.from('holdings').update(patch).eq('id', existing.id);
    return { kind: 'updated', id: existing.id };
  }
  const { data: inserted } = await ctx.sb.from('holdings').insert({
    ...patch,
    user_id: ctx.userId,
    account_id: accountId,
    pluggy_investment_id: pluggyInv.id,
    shares: pluggyInv.quantity ?? 1,
    avg_cost_cents: pluggyInv.amount != null ? Math.round(pluggyInv.amount * 100) : 0,
    user_edited_fields: [],
  }).select('id').single();
  return { kind: 'inserted', id: inserted!.id };
}
```

- [ ] **Step 4: Run, confirm PASS**

### Task B5: TDD — `mergeSource`

- [ ] **Step 1: Write failing test**

```ts
Deno.test("mergeSource creates a new source for a never-seen item", async () => {
  const ctx = makeMockCtx({ existingRows: [] });
  const pluggyItem = {
    id: 'plg_item_btg',
    connector: { id: 612, name: 'BTG Pactual', primaryColor: '#171717' },
    status: 'UPDATED',
  };
  const result = await mergeSource(pluggyItem, 'u1');
  assertEquals(result.kind, 'inserted');
  const ins = ctx.sb.tracked.sources.inserts[0];
  assertEquals(ins.pluggy_item_id, 'plg_item_btg');
  assertEquals(ins.pluggy_connector_id, 612);
  assertEquals(ins.pluggy_status, 'active');
  assertEquals(ins.name, 'BTG Pactual');
});
```

(Note: `mergeSource` takes `userId` directly, not a `MergeContext`, since it's the entry point that creates the source — and the source's id becomes the `ctx.sourceId` for everything downstream.)

- [ ] **Step 2: Run, FAIL**

- [ ] **Step 3: Implement** — straightforward upsert keyed on `(user_id, pluggy_item_id)`. Status mapping: Pluggy `'UPDATED' → 'active'`, `'LOGIN_ERROR' → 'login_error'`, `'UPDATING' → 'updating'`, `'OUTDATED' → 'outdated'`.

- [ ] **Step 4: PASS**

### Task B6: Run full merge module test suite

- [ ] **Step 1: Run all tests in `_shared/`**

Run: `cd supabase/functions && deno test _shared/ --allow-all`

Expected: every test green.

### Task B7: Commit Phase B

- [ ] **Step 1: Stage and commit**

```powershell
git add supabase/functions/_shared/ supabase/functions/import_map.json .gitignore
git commit -m @'
Step 7.5 phase B: pluggy merge module + tests

Pure-logic merge functions for transactions, accounts (with CC
auto-link), holdings, and sources. TDD'd via Deno's built-in test
runner. Sticky user_edited_fields and never-resurrect-deleted rules
covered by tests.
'@
```

---

## Phase C — Edge Functions

### Task C1: Implement `pluggy-sync` Edge Function

**Files:**
- Create: `supabase/functions/pluggy-sync/index.ts`

- [ ] **Step 1: Write the function entry point**

```ts
// supabase/functions/pluggy-sync/index.ts
import { createClient } from '@supabase/supabase-js';
import { PluggyClient } from 'pluggy-sdk';
import { mergeSource, mergeAccount, mergeTransaction, mergeHolding } from '../_shared/pluggy-merge.ts';

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 });

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sourceId } = body as { sourceId?: string };

  const pluggy = new PluggyClient({
    clientId: Deno.env.get('PLUGGY_CLIENT_ID')!,
    clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET')!,
  });

  // 1. Discover items
  const items = await pluggy.fetchItems();
  let targetItems = items.results;
  if (sourceId) {
    const { data: src } = await sb.from('sources').select('pluggy_item_id').eq('id', sourceId).single();
    targetItems = items.results.filter(i => i.id === src?.pluggy_item_id);
  }

  const counts = { sourcesUpserted: 0, accountsUpserted: 0, transactionsUpserted: 0, holdingsUpserted: 0 };
  const errors: { itemId: string, message: string }[] = [];

  // 2. Walk each item
  for (const item of targetItems) {
    try {
      const sourceResult = await mergeSource(item, user.id);
      counts.sourcesUpserted++;
      // need the source id for the merge ctx
      const { data: srcRow } = await sb.from('sources').select('id').eq('user_id', user.id).eq('pluggy_item_id', item.id).single();
      const ctx = { userId: user.id, sourceId: srcRow!.id, sb };

      const accounts = await pluggy.fetchAccounts(item.id);
      for (const acc of accounts.results) {
        await mergeAccount(acc, ctx);
        counts.accountsUpserted++;
      }

      const investments = await pluggy.fetchInvestments(item.id);
      for (const inv of investments.results) {
        await mergeHolding(inv, ctx);
        counts.holdingsUpserted++;
      }

      // Transactions: paginated, last 90 days on initial, last_synced - 1d on resync
      const fromDate = computeFromDate(srcRow);
      let page = 1;
      while (true) {
        const txPage = await pluggy.fetchTransactions(item.id, { from: fromDate, page, pageSize: 500 });
        for (const tx of txPage.results) {
          await mergeTransaction(tx, ctx);
          counts.transactionsUpserted++;
        }
        if (txPage.results.length < 500) break;
        page++;
      }

      await sb.from('sources').update({
        pluggy_status: 'active',
        pluggy_last_synced_at: new Date().toISOString(),
        pluggy_last_error: null,
      }).eq('id', srcRow!.id);
    } catch (err) {
      errors.push({ itemId: item.id, message: (err as Error).message });
    }
  }

  // 3. Log
  await sb.from('pluggy_sync_log').insert({
    user_id: user.id,
    source_id: sourceId ?? null,
    trigger: sourceId ? 'manual' : 'initial',
    status: errors.length > 0 ? 'error' : 'ok',
    completed_at: new Date().toISOString(),
    counts,
    error_message: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return Response.json({ counts, errors });
});

function computeFromDate(source: any): string {
  if (source?.pluggy_last_synced_at) {
    const d = new Date(source.pluggy_last_synced_at);
    d.setDate(d.getDate() - 1);  // 1-day overlap to catch pending → posted promotions
    return d.toISOString().split('T')[0];
  }
  // Initial: last 90 days
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}
```

- [ ] **Step 2: Local invocation smoke (no real Pluggy call yet)**

Run: `pnpm dlx supabase functions serve pluggy-sync --no-verify-jwt --env-file .env.functions` (in a separate terminal)

Expected: function starts on `http://localhost:54321/functions/v1/pluggy-sync`. Hit it with a curl that has no body and an invalid JWT — expect 401.

### Task C2: Implement `pluggy-webhook` Edge Function

**Files:**
- Create: `supabase/functions/pluggy-webhook/index.ts`

- [ ] **Step 1: Write the webhook handler**

```ts
import { createClient } from '@supabase/supabase-js';
import { PluggyClient } from 'pluggy-sdk';
import { mergeAccount, mergeTransaction, mergeHolding } from '../_shared/pluggy-merge.ts';

const WEBHOOK_SECRET = Deno.env.get('PLUGGY_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
  const sigHeader = req.headers.get('x-pluggy-signature') ?? req.headers.get('signature');
  const rawBody = await req.text();

  if (!verifySignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    return new Response('invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Look up user by item id
  const { data: source } = await sb.from('sources').select('id, user_id').eq('pluggy_item_id', event.itemId).maybeSingle();
  if (!source) return Response.json({ received: true, note: 'no matching source' });

  const ctx = { userId: source.user_id, sourceId: source.id, sb };
  const pluggy = new PluggyClient({
    clientId: Deno.env.get('PLUGGY_CLIENT_ID')!,
    clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET')!,
  });

  switch (event.event) {
    case 'item/created':
      // No-op; manual sync handles this
      break;
    case 'item/updated': {
      const accounts = await pluggy.fetchAccounts(event.itemId);
      for (const acc of accounts.results) await mergeAccount(acc, ctx);
      const investments = await pluggy.fetchInvestments(event.itemId);
      for (const inv of investments.results) await mergeHolding(inv, ctx);
      await sb.from('sources').update({
        pluggy_last_synced_at: new Date().toISOString(),
        pluggy_status: 'active',
      }).eq('id', source.id);
      break;
    }
    case 'item/login_succeeded':
      await sb.from('sources').update({ pluggy_status: 'active', pluggy_last_error: null }).eq('id', source.id);
      break;
    case 'item/error':
    case 'item/waiting_user_input':
    case 'item/waiting_user_action':
      await sb.from('sources').update({
        pluggy_status: 'login_error',
        pluggy_last_error: event.error ?? { event: event.event },
      }).eq('id', source.id);
      break;
    case 'item/deleted':
      await sb.from('sources').update({
        pluggy_status: 'disconnected',
        pluggy_item_id: null,
      }).eq('id', source.id);
      break;
    case 'transactions/created': {
      // Use createdTransactionsLink if provided; otherwise fall back to fetch by item
      const link = event.createdTransactionsLink;
      if (link) {
        const newTxs = await pluggy.fetchTransactionsByLink(link);
        for (const tx of newTxs.results) await mergeTransaction(tx, ctx);
      }
      break;
    }
    case 'transactions/updated': {
      for (const txId of event.transactionIds ?? []) {
        const tx = await pluggy.fetchTransaction(txId);
        await mergeTransaction(tx, ctx);
      }
      break;
    }
    case 'transactions/deleted': {
      for (const txId of event.transactionIds ?? []) {
        await sb.from('transactions').update({ pluggy_deleted_at: new Date().toISOString() })
          .eq('user_id', source.user_id).eq('pluggy_transaction_id', txId);
      }
      break;
    }
    default:
      console.warn(`unhandled event: ${event.event}`);
  }

  // Log webhook receipt
  await sb.from('pluggy_sync_log').insert({
    user_id: source.user_id,
    source_id: source.id,
    trigger: 'webhook',
    status: 'ok',
    completed_at: new Date().toISOString(),
    counts: { event: event.event },
  });

  return Response.json({ received: true });
});

function verifySignature(body: string, sig: string | null, secret: string): boolean {
  if (!sig) return false;
  // HMAC-SHA256 over the raw body, base64-encoded — confirm exact algorithm
  // against Pluggy SDK source at implementation time.
  const enc = new TextEncoder();
  const key = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  // Actual verification is async; for this blocking signature, use a sync-friendly lib
  // OR refactor the handler to be `async` end-to-end. We'll resolve at code time.
  return true; // PLACEHOLDER — see Implementation TBD #1 in spec
});
```

(Note: signature verification is the ONE Implementation TBD from the spec — leave the placeholder + a TODO comment, surface to user when running this task. If Pluggy SDK exposes a `verifyWebhookSignature` helper, use it instead of hand-rolling crypto.)

### Task C3: Set Edge Function secrets locally and remotely

- [ ] **Step 1: Create `.env.functions`** (LOCAL — gitignored)

Create the file `.env.functions` in repo root with:

```
PLUGGY_CLIENT_ID=<paste from pre-flight 1>
PLUGGY_CLIENT_SECRET=<paste from pre-flight 1>
PLUGGY_WEBHOOK_SECRET=<paste from pre-flight 3>
```

- [ ] **Step 2: Push secrets to Supabase**

Run:
```powershell
pnpm dlx supabase secrets set --env-file .env.functions
```

Expected: `Finished supabase secrets set` confirming all three variables.

- [ ] **Step 3: Verify secrets**

Run: `pnpm dlx supabase secrets list`

Expected: three entries listing `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET` (values masked).

### Task C4: Deploy Edge Functions

- [ ] **Step 1: Deploy both functions**

Run:
```
pnpm dlx supabase functions deploy pluggy-sync
pnpm dlx supabase functions deploy pluggy-webhook --no-verify-jwt
```

(`--no-verify-jwt` on the webhook because Pluggy's calls don't carry a Supabase JWT — the function uses its own HMAC verification.)

Expected: both functions report deployed at their respective URLs.

- [ ] **Step 2: Smoke-test the deploy**

Run from PowerShell with your auth token (get one via the OmniFlow login page → Network tab → `Authorization: Bearer ...`):

```powershell
curl.exe -X POST `
  https://mkwncqhhnkhcznauzveq.supabase.co/functions/v1/pluggy-sync `
  -H "Authorization: Bearer <token>" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Expected: 200 with a JSON body like `{"counts": {...}, "errors": []}`. If `errors` is non-empty, surface to user — likely Pluggy SDK issue or missing env var.

### Task C5: Register webhook URL in Pluggy dashboard (USER ACTION)

- [ ] **Step 1: Tell user the webhook URL**

The Edge Function URL is:
```
https://mkwncqhhnkhcznauzveq.supabase.co/functions/v1/pluggy-webhook
```

User should:
1. In Pluggy dashboard → Pluggy Demo App → Webhooks → Add Webhook
2. Paste the URL above
3. Set event filter to "all"
4. Set the secret to the same value as `PLUGGY_WEBHOOK_SECRET` in `.env.functions`
5. Click Save & Test Webhook
6. Confirm test event delivers (200 response)

### Task C6: Commit Phase C

- [ ] **Step 1: Stage and commit**

```powershell
git add supabase/functions/pluggy-sync/ supabase/functions/pluggy-webhook/
git commit -m @'
Step 7.5 phase C: pluggy-sync + pluggy-webhook edge functions

Both reuse _shared/pluggy-merge.ts. pluggy-sync: JWT-authenticated,
discovers items, walks accounts/investments/transactions per item.
pluggy-webhook: HMAC-verified, dispatches on event.event, defense-in-
depth user_id constraint via sources.pluggy_item_id lookup.

Webhook signature verification placeholder noted for code-time
resolution against pluggy-sdk source.
'@
```

---

## Phase D — Client mutations & queries

### Task D1: Add useSyncFromPluggy mutation

**Files:**
- Create: `src/features/sources/pluggy-mutations.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useSyncFromPluggy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId?: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pluggy-sync`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      return res.json() as Promise<{ counts: any; errors: any[] }>;
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['sources'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
      qc.invalidateQueries({ queryKey: ['account-balances'] });
      qc.invalidateQueries({ queryKey: ['pluggy-sync-log'] });
      const c = result.counts;
      const partial = result.errors.length > 0;
      const msg = `Synced ${c.transactionsUpserted} transactions, ${c.accountsUpserted} accounts, ${c.holdingsUpserted} holdings`;
      partial ? toast.warning(`${msg} (${result.errors.length} errors)`) : toast.success(msg);
    },
    onError: (err) => toast.error(`Sync failed: ${(err as Error).message}`),
  });
}
```

### Task D2: Add useSyncLog query

**Files:**
- Create: `src/features/sources/pluggy-queries.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useSyncLog(limit = 30) {
  return useQuery({
    queryKey: ['pluggy-sync-log', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pluggy_sync_log')
        .select('*, source:sources(name, pluggy_connector_id)')
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}
```

### Task D3: Update existing mutations to track user_edited_fields

**Files:**
- Modify: `src/features/transactions/mutations.ts`
- Modify: `src/features/accounts/mutations.ts`

- [ ] **Step 1: In `useUpdateTransaction`, diff form values vs current row and append changed fields to user_edited_fields**

Inside the mutation function (replace the body of `useUpdateTransaction`):

```ts
mutationFn: async (input: TransactionUpdateInput) => {
  const { data: existing } = await supabase
    .from('transactions')
    .select('description, category_id, type, payment_method, account_id, user_edited_fields, pluggy_transaction_id')
    .eq('id', input.id)
    .single();

  // Only track edits on Pluggy-managed rows
  let editedFields = existing?.user_edited_fields ?? [];
  if (existing?.pluggy_transaction_id) {
    const TRACK = ['description','category_id','type','payment_method','account_id'] as const;
    for (const f of TRACK) {
      if (input[f] !== undefined && input[f] !== existing[f] && !editedFields.includes(f)) {
        editedFields = [...editedFields, f];
      }
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ ...input, user_edited_fields: editedFields })
    .eq('id', input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Same pattern for `useUpdateAccount`** — track changes to `type`, `name`, `currency` against accounts that have `pluggy_account_id` set.

### Task D4: Commit Phase D

```powershell
git add src/features/sources/pluggy-mutations.ts src/features/sources/pluggy-queries.ts `
        src/features/transactions/mutations.ts src/features/accounts/mutations.ts
git commit -m "Step 7.5 phase D: client mutations + sticky-edit tracking"
```

---

## Phase E — UI surfaces

### Task E1: Sources page lanes

**Files:**
- Modify: `src/features/settings/sources-section.tsx`

- [ ] **Step 1: Split rendered sources into Pluggy-managed and Manual groups using `isPluggyManaged(source)`. Add a top section header with the "Sync from Pluggy" button. Each Pluggy source row gets the status indicator + sync timestamp. Each Manual source row stays exactly as it is today.**

(Implementation: ~80 LOC change in `sources-section.tsx`. Filter `sources.filter(s => isPluggyManaged(s))` for the Pluggy lane, the rest for Manual. Use existing source-row rendering for both, layering Pluggy chrome on top of the Pluggy lane.)

- [ ] **Step 2: Add status dot helper**

```tsx
function StatusDot({ status }: { status: Source['pluggy_status'] }) {
  const tone = {
    active: 'bg-green-500',
    updating: 'bg-yellow-400 animate-pulse',
    login_error: 'bg-red-500',
    waiting_user_input: 'bg-red-500',
    outdated: 'bg-amber-500',
    disconnected: 'bg-gray-400',
  }[status ?? 'active'];
  return <span className={`inline-block size-2 rounded-full ${tone}`} />;
}
```

- [ ] **Step 3: Add the Sync button at top of Pluggy lane**

```tsx
<div className="flex items-center justify-between">
  <h3>PLUGGY-MANAGED</h3>
  <Button size="sm" onClick={() => syncMutation.mutate(undefined)} disabled={syncMutation.isPending}>
    <RefreshCw className={syncMutation.isPending ? 'animate-spin' : ''} />
    Sync from Pluggy
  </Button>
</div>
```

### Task E2: Transactions table — synced + edited badges

**Files:**
- Modify: `src/features/transactions/transactions-table.tsx`

- [ ] **Step 1: Render the badge inline with the description**

```tsx
{tx.pluggy_transaction_id && (
  <Tooltip>
    <TooltipTrigger>
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <RefreshCw className="size-3" />
        {tx.user_edited_fields.length > 0 && <Pencil className="size-2.5" />}
      </span>
    </TooltipTrigger>
    <TooltipContent>
      Synced from Pluggy
      {tx.user_edited_fields.length > 0 && ` · you edited ${tx.user_edited_fields.join(', ')}`}
    </TooltipContent>
  </Tooltip>
)}
{tx.pluggy_deleted_at && <span className="ml-2 text-xs text-red-500">Reversed by bank</span>}
```

- [ ] **Step 2: Apply strikethrough class when `pluggy_deleted_at` is set on the row's description span.**

### Task E3: Transaction edit dialog — disable bank-truth fields, show sticky-edit note

**Files:**
- Modify: `src/features/transactions/transaction-form.tsx`

- [ ] **Step 1: When `transaction.pluggy_transaction_id` is set, disable the `amount` and `date` inputs and add a tooltip saying "Bank-truth fields cannot be edited."**

- [ ] **Step 2: Above the form (when editing a Pluggy row), render a small `<p>` with the text "Your edits will not be overwritten by future syncs."**

- [ ] **Step 3: In the source picker, render Pluggy-managed sources as disabled options with a "(sync only)" suffix.**

```tsx
<SelectItem value={source.id} disabled={isPluggyManaged(source)}>
  <div className="flex items-center gap-2">
    <span style={{ color: source.color }}>●</span>
    {source.name}
    {isPluggyManaged(source) && <span className="text-muted-foreground">(sync only)</span>}
  </div>
</SelectItem>
```

### Task E4: Account edit dialog — same sticky-edit pattern

**Files:**
- Modify: `src/features/accounts/account-form.tsx`

- [ ] **Step 1: When the account has `pluggy_account_id`, render the sticky-edit note.**

(No fields to disable here — `type`, `name`, `currency` are intentionally editable per the spec.)

### Task E5: Recent syncs card

**Files:**
- Modify: `src/features/settings/data-section.tsx` (or wherever the Data tab renders today)

- [ ] **Step 1: Render `useSyncLog()` results as a list. Each row: status icon (✓/✗), trigger, source name, time-ago, summary or error message.**

(Component: ~50 LOC. Reuse existing card primitives.)

### Task E6: Commit Phase E

```powershell
git add src/features/settings/ src/features/transactions/ src/features/accounts/
git commit -m "Step 7.5 phase E: UI for Pluggy lane, sticky-edit indicators, sync log"
```

---

## Phase F — Smoke test & finalize

### Task F1: Sandbox smoke checklist

USER ACTIONS — Claude assists by guiding through, but the user clicks.

- [ ] **Step 1: Connect a sandbox bank at meu.pluggy.ai (sandbox env)**

In the user's meu.pluggy account, connect any sandbox connector — Nubank sandbox is the recommended starter. Verify it appears in the Pluggy Demo App's items list in the dashboard.

- [ ] **Step 2: Click "Sync from Pluggy" in OmniFlow**

Expected: toast appears with non-zero counts. New source row appears in Pluggy-managed lane with `synced Xs ago`. Click to expand: accounts visible.

- [ ] **Step 3: Edit a transaction's category**

Pick any imported transaction, click to edit, change the category, save. Expected: the row's description badge gets the pencil overlay (synced + edited).

- [ ] **Step 4: Re-trigger sync**

Click "Sync from Pluggy" again. Expected: the edit you made survives. Pluggy's category did NOT overwrite yours.

- [ ] **Step 5: Edit an account's type**

(If sandbox returned a misclassified account.) Change the type. Re-trigger sync. Expected: type stays as user set it.

- [ ] **Step 6: Soft-delete a transaction, then sync**

Right-click a Pluggy-imported tx → delete. Sync again. Expected: the row does NOT come back.

- [ ] **Step 7: Trigger a sandbox `transactions/created` event from Pluggy dashboard**

In the Pluggy dashboard's webhook test tool, fire a `transactions/created` event for the sandbox item. Expected: webhook fires, new row appears in OmniFlow without page reload (TanStack Query refetches via webhook-driven cache invalidation OR you manually refresh — both acceptable for 7.5).

- [ ] **Step 8: Trigger a sandbox `item/error`**

Same dashboard tool. Expected: source row's status dot goes red, "Reconnect at meu.pluggy" link appears.

- [ ] **Step 9: Trigger `transactions/deleted`**

Expected: a previously-imported row now renders strikethrough with "Reversed by bank" badge. Row not gone — soft-marked.

- [ ] **Step 10: Open new-transaction dialog**

Verify the source picker shows Pluggy-managed sources as disabled with the "(sync only)" suffix.

If ALL 10 steps pass: Phase F1 complete.

### Task F2: Update CLAUDE.md status block

- [ ] **Step 1: Edit `CLAUDE.md`'s `## Status` section to add the Step 7.5 done bullet**

Add after the existing Step 7 entries:

```markdown
- **Step 7.5** — **Migration 007 + Pluggy Open Finance integration.** Migration adds Pluggy linkage columns to sources/accounts/transactions, the holdings table (with Pluggy fields), and pluggy_sync_log audit. Two Edge Functions land: `pluggy-sync` (JWT-auth'd, discovers items via meu.pluggy Data Passport, walks accounts/transactions/investments) and `pluggy-webhook` (HMAC-verified, dispatches on event.event). Shared `_shared/pluggy-merge.ts` handles upserts respecting `user_edited_fields[]` and never resurrecting soft-deleted rows. Sources page split into Pluggy/Manual lanes; `Sync from Pluggy` button discovers + syncs all items. Transactions table gains synced + edited indicators; transaction edit dialog disables bank-truth fields and tracks user edits. Pluggy CCs auto-link to sibling checking under same Item via `accounts.pluggy_cc_account_id`. Smoke-tested against sandbox connectors before flipping to production.
```

- [ ] **Step 2: Flip the Roadmap checkbox**

Change in `## Roadmap`:
```markdown
- [x] **Step 7.5** — Migration 007 + Pluggy Open Finance integration
```

- [ ] **Step 3: Update the "Next step" pointer**

Change the closing line in `## Status` to:
```markdown
Next step (step 8) is **Investments page UI** — the holdings table and `holding_id` column already exist (landed in 7.5). See `implementation_plan.md` step 8.
```

### Task F3: Update `implementation_plan.md`

- [ ] **Step 1: Add a new `### Step 7.5` section to `implementation_plan.md`** between Step 7 and Step 8, summarizing what landed and pointing at the spec/plan.

- [ ] **Step 2: Update the Step 8 description** to reflect that holdings already exist; only the UI work remains.

- [ ] **Step 3: Update the migration list section** if any migration-numbering text drifted.

### Task F4: Final commit

```powershell
git add CLAUDE.md implementation_plan.md
git commit -m @'
Step 7.5 complete: Pluggy Open Finance integration

Migration 007, two Edge Functions (pluggy-sync + pluggy-webhook),
shared merge module, Sources lane split, transactions table indicators,
sticky-edit tracking. Smoke-tested against sandbox connectors.
'@
git push origin master
```

---

## Implementation TBDs (from spec, resolve at code time)

When you reach Task C2 step 1, you'll hit the webhook signature placeholder. Resolve it ONE of two ways:

1. **Pluggy SDK exposes a `verifyWebhookSignature(body, sig, secret)` helper** — use it directly, replace the placeholder.
2. **No SDK helper** — read `node_modules/pluggy-sdk/src/` (after `npm i pluggy-sdk` locally) for the algorithm, then implement in Deno's `crypto.subtle`. Likely HMAC-SHA256 over the raw request body, base64-encoded, but verify before shipping.

Surface the result to the user when you implement it — they should know which path was taken.

---

## Self-review notes

- ✅ Spec coverage: every section of the spec maps to a task in this plan.
- ✅ No "TBD" / "implement later" language except the explicit Implementation TBDs section, which references the spec and gives concrete resolution steps.
- ✅ Type consistency: function names match (`mergeTransaction`, `mergeAccount`, `mergeHolding`, `mergeSource`) across tasks B2-B5 and C1-C2.
- ✅ Frequent commits: 6 commits across phases A→F. Each phase produces a working slice.
- ⚠ TDD limited to merge module (Phase B). Edge Functions and UI rely on smoke testing — matches the existing OmniFlow pattern (no client-side test runner currently configured).
