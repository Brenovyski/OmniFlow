-- OmniFlow migration 002 — English-by-default and category types.
--
-- Three things happen here:
--   1. Translate the migration 001 seed (which used Brazilian Portuguese
--      names like "Mercado" and "Salário") to English. Only rows that
--      still match the original seed are renamed — anything you've
--      already customized is left alone.
--   2. Add a `type` column to public.categories so each category belongs
--      to exactly one transaction type (expense | earning | investment).
--      Without this, the new-tx form had to show every category for any
--      type, forcing the user to mentally filter (Salary next to
--      Groceries when logging an expense).
--   3. Replace the new-user seed trigger with a richer English starter
--      set: 4 accounts (debit, credit_card, voucher, brokerage) and 9
--      categories (2 earnings, 6 expenses, 1 investment). Existing users
--      are topped up with the 3 categories the new seed adds, but their
--      existing accounts are left alone (account creation goes through
--      the UI in step 5).
--
-- App language stays English by default. Translation will be a later
-- feature; for now, only data the user types (transaction descriptions,
-- custom category/account names) is in whatever language they typed it.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Translate the migration 001 seed names. Idempotent: only rows that
--    still match the original PT-BR seed are renamed.

update public.categories set name = 'Groceries'    where name = 'Mercado';
update public.categories set name = 'Rent'         where name = 'Aluguel';
update public.categories set name = 'Salary'       where name = 'Salário';
update public.categories set name = 'Restaurants'  where name = 'Restaurantes';
update public.categories set name = 'Transport'    where name = 'Transporte';
update public.categories set name = 'Bills'        where name = 'Contas';

update public.accounts
   set name = 'Checking', short_name = 'Checking'
 where name = 'Conta Principal';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Schema change — categories belong to a single transaction type.

alter table public.categories
  add column type text not null default 'expense'
  check (type in ('expense', 'earning', 'investment'));

update public.categories set type = 'earning' where name = 'Salary';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Replace the new-user seed trigger with English starter data:
--    4 accounts, 9 categories.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, short_name, color, icon, currency) values
    (new.id, 'Checking',     'debit',       'Checking',  '#0EA5E9', 'Wallet',     'BRL'),
    (new.id, 'Credit Card',  'credit_card', 'CC',        '#0F172A', 'CreditCard', 'BRL'),
    (new.id, 'Voucher',      'voucher',     'Voucher',   '#22C55E', 'Receipt',    'BRL'),
    (new.id, 'Brokerage',    'brokerage',   'Brokerage', '#FACC15', 'TrendingUp', 'BRL');

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Top up existing users with the new categories they don't have yet
--    (Freelance, Subscriptions, Stocks). Idempotent: skips any name the
--    user already has, so safe to re-run.

insert into public.categories (user_id, name, color, icon, type)
select u.id, missing.name, missing.color, missing.icon, missing.type
from auth.users u
cross join (values
  ('Freelance',     '#15803D', 'Sparkles',   'earning'),
  ('Subscriptions', '#DB2777', 'Tag',        'expense'),
  ('Stocks',        '#6D28D9', 'TrendingUp', 'investment')
) as missing(name, color, icon, type)
where not exists (
  select 1 from public.categories c
  where c.user_id = u.id and c.name = missing.name
);
