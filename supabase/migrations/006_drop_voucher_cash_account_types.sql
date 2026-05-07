-- OmniFlow migration 006 — drop voucher/cash from account kinds.
--
-- After live discussion, the user reframed `voucher` and `cash` as *payment
-- methods* (which they already are) rather than account kinds. The account
-- table now hosts only real liquid pools: checking, savings, brokerage.
--
-- Wipes any existing voucher/cash accounts and the transactions that
-- reference them. The seed trigger from migration 004 already only created
-- checking/savings/brokerage accounts, so for fresh users this is a no-op.

-- Drop transactions that reference voucher/cash accounts on either side.
delete from public.transactions
  where account_id in (select id from public.accounts where type in ('voucher','cash'))
     or transfer_account_id in (select id from public.accounts where type in ('voucher','cash'));

-- Now safe to drop the accounts themselves.
delete from public.accounts where type in ('voucher','cash');

-- Tighten the check constraint to the surviving kinds.
alter table public.accounts drop constraint accounts_type_check;
alter table public.accounts add constraint accounts_type_check
  check (type in ('checking','savings','brokerage'));
