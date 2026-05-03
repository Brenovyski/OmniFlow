-- OmniFlow migration 003 — derived account balances + transfers + archive.
--
-- Three changes:
--   1. accounts: add `opening_balance_cents` (the only writable balance
--      field), add `archived_at` (soft delete preserves transaction
--      integrity), drop the unused `balance_cents` column. App code never
--      wrote to it; the runtime balance is now derived.
--   2. transactions: add a fourth `type = 'transfer'` and a nullable
--      `transfer_account_id` pointing at the destination account. Two
--      check constraints lock down the relationship: transfer iff the
--      destination is set, and source/destination must differ.
--   3. account_balances_v: a view that returns one row per account with
--      the live derived balance (opening + signed sums of non-deleted
--      transactions). Sign rule:
--        * +amount on this account when type ∈ {earning, investment}
--          OR (type=transfer AND this account is the destination).
--        * -amount on this account when type=expense
--          OR (type=transfer AND this account is the source).
--      Investments are modeled as movements *into* a brokerage account,
--      mirroring the prototype.
--
-- The view runs with security_invoker so RLS of the underlying tables
-- gates which rows the caller sees. No view-specific policies needed.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. accounts schema changes

alter table public.accounts
  add column opening_balance_cents bigint not null default 0;

alter table public.accounts
  add column archived_at timestamptz;

alter table public.accounts
  drop column balance_cents;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. transactions: transfer support

alter table public.transactions
  drop constraint transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (type in ('expense', 'earning', 'investment', 'transfer'));

alter table public.transactions
  add column transfer_account_id uuid references public.accounts(id) on delete restrict;

alter table public.transactions
  add constraint transactions_transfer_link_check
  check ((type = 'transfer') = (transfer_account_id is not null));

alter table public.transactions
  add constraint transactions_transfer_self_check
  check (type <> 'transfer' or transfer_account_id <> account_id);

create index transactions_transfer_account_date_idx
  on public.transactions (transfer_account_id, date desc)
  where transfer_account_id is not null and deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. derived-balance view

create or replace view public.account_balances_v
with (security_invoker = on) as
select
  a.id      as account_id,
  a.user_id as user_id,
  (
    a.opening_balance_cents
    + coalesce(sum(
        case
          when t.deleted_at is not null then 0
          when t.type = 'expense' and t.account_id = a.id then -t.amount_cents
          when t.type in ('earning', 'investment') and t.account_id = a.id then t.amount_cents
          when t.type = 'transfer' and t.account_id = a.id then -t.amount_cents
          when t.type = 'transfer' and t.transfer_account_id = a.id then t.amount_cents
          else 0
        end
      ), 0)
  ) as balance_cents
from public.accounts a
left join public.transactions t
  on (t.account_id = a.id or t.transfer_account_id = a.id)
  and t.user_id = a.user_id
group by a.id, a.user_id, a.opening_balance_cents;

grant select on public.account_balances_v to authenticated;

comment on view public.account_balances_v is
  'Per-account derived balance: opening_balance_cents plus signed sums of non-deleted transactions, including transfers. RLS via security_invoker against underlying tables.';
