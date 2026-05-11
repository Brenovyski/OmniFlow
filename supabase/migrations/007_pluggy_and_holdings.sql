-- OmniFlow migration 007 — Pluggy linkage + holdings table.
--
-- Combines Pluggy integration columns (sources/accounts/transactions) with
-- the holdings table that was previously planned for step 8. Holdings ships
-- now because Pluggy investments map directly into it.
--
-- See docs/superpowers/specs/2026-05-10-pluggy-step-7.5-design.md for the
-- design rationale (sticky user_edited_fields, append-only into OmniFlow,
-- CC auto-link to sibling checking, etc.).
--
-- Order inside the file is FK-safe:
--   1. sources    — add Pluggy linkage columns
--   2. accounts   — add Pluggy linkage + sticky-edit + CC link
--   3. holdings   — new table (must precede transactions for the FK)
--   4. transactions — add Pluggy linkage + sticky-edit + holding_id FK
--   5. pluggy_sync_log — debugging audit trail

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SOURCES — Pluggy linkage columns.
--    A Source is Pluggy-managed iff pluggy_item_id is not null.

alter table public.sources add column pluggy_item_id        text;
alter table public.sources add column pluggy_connector_id   integer;
alter table public.sources add column pluggy_status         text
  check (pluggy_status in ('active','login_error','updating','outdated','disconnected'));
alter table public.sources add column pluggy_last_synced_at timestamptz;
alter table public.sources add column pluggy_last_error     jsonb;

create unique index sources_pluggy_item_uniq
  on public.sources (user_id, pluggy_item_id) where pluggy_item_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ACCOUNTS — Pluggy linkage + CC auto-link + sticky-edit tracking.
--    pluggy_account_id is the bank/checking/savings/brokerage Pluggy id.
--    pluggy_cc_account_id is set on a checking row that hosts a linked CC.

alter table public.accounts add column pluggy_account_id             text;
alter table public.accounts add column pluggy_cc_account_id          text;
alter table public.accounts add column pluggy_subtype                text;
alter table public.accounts add column pluggy_owner                  text;
alter table public.accounts add column pluggy_marketing_name         text;
alter table public.accounts add column pluggy_available_credit_cents bigint;
alter table public.accounts add column pluggy_balance_due_date       date;
alter table public.accounts add column pluggy_balance_close_date     date;
alter table public.accounts add column pluggy_cc_brand               text;
alter table public.accounts add column user_edited_fields            text[] not null default '{}';

create unique index accounts_pluggy_account_uniq
  on public.accounts (user_id, pluggy_account_id) where pluggy_account_id is not null;
create unique index accounts_pluggy_cc_uniq
  on public.accounts (user_id, pluggy_cc_account_id) where pluggy_cc_account_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HOLDINGS — new table. Must precede the transactions.holding_id FK below.

create table public.holdings (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  account_id                  uuid not null references public.accounts(id) on delete cascade,
  ticker                      text,
  name                        text not null,
  shares                      numeric(20,6) not null default 0,
  avg_cost_cents              bigint not null default 0,
  current_price_cents         bigint not null default 0,
  currency                    text not null default 'BRL',
  notes                       text,
  pluggy_investment_id        text,
  pluggy_status               text check (pluggy_status in ('ACTIVE','PENDING','TOTAL_WITHDRAWAL')),
  pluggy_isin                 text,
  pluggy_issuer               text,
  pluggy_amount_profit_cents  bigint,
  pluggy_taxes_cents          bigint,
  pluggy_rate                 numeric(8,4),
  pluggy_rate_type            text,
  pluggy_last_12m_rate        numeric(8,4),
  pluggy_due_date             date,
  user_edited_fields          text[] not null default '{}',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index holdings_user_id_idx     on public.holdings (user_id);
create index holdings_account_id_idx  on public.holdings (account_id);

create unique index holdings_pluggy_investment_uniq
  on public.holdings (user_id, pluggy_investment_id) where pluggy_investment_id is not null;

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

alter table public.holdings enable row level security;

create policy "holdings_select_own"
  on public.holdings for select using (auth.uid() = user_id);
create policy "holdings_insert_own"
  on public.holdings for insert with check (auth.uid() = user_id);
create policy "holdings_update_own"
  on public.holdings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "holdings_delete_own"
  on public.holdings for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRANSACTIONS — Pluggy linkage, sticky-edit, holding_id FK,
--    pluggy_deleted_at (soft-mark only — never hard delete from sync).

alter table public.transactions add column pluggy_transaction_id        text;
alter table public.transactions add column pluggy_status                text
  check (pluggy_status in ('PENDING','POSTED'));
alter table public.transactions add column pluggy_category              text;
alter table public.transactions add column pluggy_description_raw       text;
alter table public.transactions add column pluggy_provider_code         text;
alter table public.transactions add column pluggy_balance_after_cents   bigint;
alter table public.transactions add column pluggy_merchant_name         text;
alter table public.transactions add column pluggy_merchant_category     text;
alter table public.transactions add column pluggy_cc_installment        int;
alter table public.transactions add column pluggy_cc_total_installments int;
alter table public.transactions add column pluggy_cc_bill_id            text;
alter table public.transactions add column pluggy_deleted_at            timestamptz;
alter table public.transactions add column user_edited_fields           text[] not null default '{}';
alter table public.transactions add column holding_id                   uuid references public.holdings(id) on delete set null;

create unique index transactions_pluggy_uniq
  on public.transactions (user_id, pluggy_transaction_id) where pluggy_transaction_id is not null;

create index transactions_holding_id_idx on public.transactions (holding_id) where holding_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PLUGGY_SYNC_LOG — debugging audit trail. Single JSONB column accepted
--    here because counts shape varies per trigger and is debug-only.

create table public.pluggy_sync_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  source_id     uuid references public.sources(id) on delete cascade,
  trigger       text not null check (trigger in ('manual','webhook','initial','reconnect')),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  status        text not null check (status in ('running','ok','error')),
  counts        jsonb,
  error_message text
);

create index pluggy_sync_log_user_started_idx
  on public.pluggy_sync_log (user_id, started_at desc);

alter table public.pluggy_sync_log enable row level security;

create policy "pluggy_sync_log_select_own"
  on public.pluggy_sync_log for select using (auth.uid() = user_id);
-- Inserts come from the Edge Functions using the service-role key, which
-- bypasses RLS. We still expose insert/delete to authenticated users in case
-- they ever need to clear their own log from the UI.
create policy "pluggy_sync_log_insert_own"
  on public.pluggy_sync_log for insert with check (auth.uid() = user_id);
create policy "pluggy_sync_log_delete_own"
  on public.pluggy_sync_log for delete using (auth.uid() = user_id);
