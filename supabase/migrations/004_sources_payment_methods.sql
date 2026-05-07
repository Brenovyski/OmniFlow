-- OmniFlow migration 004 — sources + payment methods + credit-card model.
--
-- Sweeping model overhaul:
--   1. New `sources` table (institutions: BTG, Nubank, Brex, Pluxxee). Each
--      source has a kind (bank/benefits/broker/cash/custom) and a chosen set
--      of payment methods stored in `source_payment_methods`.
--   2. `accounts` belong to a source via `source_id`. The 'credit_card' kind
--      goes away; in its place, checking accounts can carry an optional
--      `credit_limit_cents` representing the credit-card limit attached to
--      that checking. The 'debit' kind is renamed to 'checking' for clarity.
--   3. `transactions.payment_method` (pix | debit_card | credit_card |
--      transfer | wire | cash | voucher) records HOW the money moved. For
--      payment_method='credit_card', `settled_at` tracks when the bill was
--      paid — until then the charge accumulates as "outstanding" and does
--      NOT debit the checking balance.
--   4. `account_balances_v` re-derived to exclude unsettled CC charges.
--      New `credit_card_outstanding_v` exposes the per-checking outstanding
--      pile that the dashboard's "Credit cards" card reads.
--   5. New-user seed trigger replaced; data wipe (transactions + accounts +
--      sources) for any existing users so the new-model defaults take effect.
--      Categories are preserved — they're orthogonal to the source model.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New sources + source_payment_methods tables.

create table public.sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('bank','benefits','broker','cash','custom')),
  color       text,
  icon        text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sources_user_id_idx on public.sources (user_id);

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

alter table public.sources enable row level security;

create policy "sources_select_own"
  on public.sources for select using (auth.uid() = user_id);
create policy "sources_insert_own"
  on public.sources for insert with check (auth.uid() = user_id);
create policy "sources_update_own"
  on public.sources for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sources_delete_own"
  on public.sources for delete using (auth.uid() = user_id);

create table public.source_payment_methods (
  source_id uuid not null references public.sources(id) on delete cascade,
  method    text not null check (method in ('pix','debit_card','credit_card','transfer','wire','cash','voucher')),
  primary key (source_id, method)
);

alter table public.source_payment_methods enable row level security;

create policy "spm_select_own"
  on public.source_payment_methods for select
  using (exists (select 1 from public.sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "spm_insert_own"
  on public.source_payment_methods for insert
  with check (exists (select 1 from public.sources s where s.id = source_id and s.user_id = auth.uid()));
create policy "spm_delete_own"
  on public.source_payment_methods for delete
  using (exists (select 1 from public.sources s where s.id = source_id and s.user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. accounts: add source_id + credit_limit_cents (nullable for now; we wipe
--    rows below before tightening source_id to NOT NULL).

alter table public.accounts
  add column source_id uuid references public.sources(id) on delete restrict;

alter table public.accounts
  add column credit_limit_cents bigint;

create index accounts_source_id_idx on public.accounts (source_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. transactions: payment_method + settled_at, with check constraints.

alter table public.transactions
  add column payment_method text;

alter table public.transactions
  add column settled_at timestamptz;

alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method is null
         or payment_method in ('pix','debit_card','credit_card','transfer','wire','cash','voucher'));

-- settled_at is only meaningful for credit-card charges.
alter table public.transactions
  add constraint transactions_settled_only_cc_check
  check (settled_at is null or payment_method = 'credit_card');

create index transactions_cc_outstanding_idx
  on public.transactions (account_id)
  where payment_method = 'credit_card' and settled_at is null and deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. WIPE existing transactions, accounts, sources rows so the new-model
--    defaults can land cleanly. Categories are preserved.

delete from public.transactions;
delete from public.accounts;
-- sources is brand new, nothing to delete there.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Now that no rows exist, swap accounts.type check: drop 'debit' and
--    'credit_card', add 'checking'. And tighten accounts.source_id to NOT NULL.

alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('checking','voucher','brokerage','cash','savings'));

alter table public.accounts alter column source_id set not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Re-derive account_balances_v: unsettled CC charges do NOT touch the
--    underlying checking balance. They land only after settled_at fills in.

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
          -- Unsettled CC charges are tracked separately; no balance impact yet.
          when coalesce(t.payment_method, '') = 'credit_card' and t.settled_at is null then 0
          when t.type = 'expense'    and t.account_id = a.id           then -t.amount_cents
          when t.type in ('earning','investment') and t.account_id = a.id then t.amount_cents
          when t.type = 'transfer'   and t.account_id = a.id           then -t.amount_cents
          when t.type = 'transfer'   and t.transfer_account_id = a.id  then t.amount_cents
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
  'Per-account derived balance. Excludes unsettled credit-card transactions; those accumulate in credit_card_outstanding_v until the bill is paid.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. credit_card_outstanding_v: per-account sum of unsettled CC charges. The
--    dashboard "Credit cards" card reads this to show outstanding/limit/used.

create or replace view public.credit_card_outstanding_v
with (security_invoker = on) as
select
  a.id      as account_id,
  a.user_id as user_id,
  coalesce(sum(t.amount_cents), 0) as outstanding_cents
from public.accounts a
left join public.transactions t
  on  t.account_id     = a.id
  and t.user_id        = a.user_id
  and t.payment_method = 'credit_card'
  and t.settled_at     is null
  and t.deleted_at     is null
group by a.id, a.user_id;

grant select on public.credit_card_outstanding_v to authenticated;

comment on view public.credit_card_outstanding_v is
  'Per-checking-account sum of credit-card charges that have not been settled yet (bill not yet paid).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Replace handle_new_user with new-model seed: 1 default Source ("Personal"),
--    its 4 standard methods, and 3 accounts (Checking, Savings, Investments).
--    Categories seed is unchanged from migration 002.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
begin
  insert into public.sources (user_id, name, kind, color)
  values (new.id, 'Personal', 'bank', '#FACC15')
  returning id into v_source_id;

  insert into public.source_payment_methods (source_id, method) values
    (v_source_id, 'pix'),
    (v_source_id, 'debit_card'),
    (v_source_id, 'credit_card'),
    (v_source_id, 'transfer');

  insert into public.accounts
    (user_id, source_id, name, type, short_name, color, icon, currency, opening_balance_cents)
  values
    (new.id, v_source_id, 'Checking',    'checking',  'Checking',  '#0EA5E9', 'Wallet',     'BRL', 0),
    (new.id, v_source_id, 'Savings',     'savings',   'Savings',   '#22C55E', 'PiggyBank',  'BRL', 0),
    (new.id, v_source_id, 'Investments', 'brokerage', 'Invest',    '#FACC15', 'TrendingUp', 'BRL', 0);

  insert into public.categories (user_id, name, color, icon, type) values
    -- earnings
    (new.id, 'Salary',        '#15803D', 'Briefcase',   'earning'),
    (new.id, 'Freelance',     '#15803D', 'Sparkles',    'earning'),
    -- expenses
    (new.id, 'Groceries',     '#15803D', 'ShoppingBag', 'expense'),
    (new.id, 'Rent',          '#0EA5E9', 'Home',        'expense'),
    (new.id, 'Restaurants',   '#EA580C', 'Coffee',      'expense'),
    (new.id, 'Transport',     '#A16207', 'Car',         'expense'),
    (new.id, 'Bills',         '#0891B2', 'Bolt',        'expense'),
    (new.id, 'Subscriptions', '#DB2777', 'Tag',         'expense'),
    -- investments
    (new.id, 'Stocks',        '#6D28D9', 'TrendingUp',  'investment');

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Seed existing users (we just wiped their accounts/transactions). Idempotent:
--    skips users who already have a source. Categories preserved from before.

do $$
declare
  u_id        uuid;
  v_source_id uuid;
begin
  for u_id in select id from auth.users loop
    if exists (select 1 from public.sources where user_id = u_id) then
      continue;
    end if;

    insert into public.sources (user_id, name, kind, color)
    values (u_id, 'Personal', 'bank', '#FACC15')
    returning id into v_source_id;

    insert into public.source_payment_methods (source_id, method) values
      (v_source_id, 'pix'),
      (v_source_id, 'debit_card'),
      (v_source_id, 'credit_card'),
      (v_source_id, 'transfer');

    insert into public.accounts
      (user_id, source_id, name, type, short_name, color, icon, currency, opening_balance_cents)
    values
      (u_id, v_source_id, 'Checking',    'checking',  'Checking',  '#0EA5E9', 'Wallet',     'BRL', 0),
      (u_id, v_source_id, 'Savings',     'savings',   'Savings',   '#22C55E', 'PiggyBank',  'BRL', 0),
      (u_id, v_source_id, 'Investments', 'brokerage', 'Invest',    '#FACC15', 'TrendingUp', 'BRL', 0);
  end loop;
end $$;
