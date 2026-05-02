-- OmniFlow migration 002 — categories belong to a single transaction type.
--
-- Without a type column, every category appeared in the new-transaction
-- dropdown regardless of whether the user picked Expense, Earning, or
-- Investment, forcing them to mentally filter (e.g. "Salário" alongside
-- "Mercado" when logging an expense). This migration scopes categories to
-- one type, backfills existing rows, replaces the new-user seed with a
-- richer starter set (9 categories + 4 accounts), and tops up the missing
-- categories for users who already exist.
--
-- Paste this entire file into the Supabase dashboard SQL Editor and run.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema change

alter table public.categories
  add column type text not null default 'expense'
  check (type in ('expense', 'earning', 'investment'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill existing rows (default 'expense' is correct for most names
--    we've seeded; only Salário from the original seed is an earning).

update public.categories set type = 'earning' where name = 'Salário';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Replace the new-user seed trigger with a richer starter set:
--    - 4 accounts (debit, credit_card, voucher, brokerage)
--    - 9 categories (2 earnings, 6 expenses, 1 investment)

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
    (new.id, 'Conta Corrente',     'debit',       'Corrente', '#0EA5E9', 'Wallet',     'BRL'),
    (new.id, 'Cartão de Crédito',  'credit_card', 'Cartão',   '#0F172A', 'CreditCard', 'BRL'),
    (new.id, 'Vale Refeição',      'voucher',     'VR',       '#22C55E', 'Receipt',    'BRL'),
    (new.id, 'Investimentos',      'brokerage',   'Inv',      '#FACC15', 'TrendingUp', 'BRL');

  insert into public.categories (user_id, name, color, icon, type) values
    -- earnings
    (new.id, 'Salário',      '#15803D', 'Briefcase',   'earning'),
    (new.id, 'Freelance',    '#15803D', 'Sparkles',    'earning'),
    -- expenses
    (new.id, 'Mercado',      '#15803D', 'ShoppingBag', 'expense'),
    (new.id, 'Aluguel',      '#0EA5E9', 'Home',        'expense'),
    (new.id, 'Restaurantes', '#EA580C', 'Coffee',      'expense'),
    (new.id, 'Transporte',   '#A16207', 'Car',         'expense'),
    (new.id, 'Contas',       '#0891B2', 'Bolt',        'expense'),
    (new.id, 'Assinaturas',  '#DB2777', 'Tag',         'expense'),
    -- investments
    (new.id, 'Ações',        '#6D28D9', 'TrendingUp',  'investment');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Top up existing users with the new categories they don't have yet
--    (Freelance, Assinaturas, Ações). Idempotent: skips any name the user
--    already has, so safe to re-run.

insert into public.categories (user_id, name, color, icon, type)
select u.id, missing.name, missing.color, missing.icon, missing.type
from auth.users u
cross join (values
  ('Freelance',    '#15803D', 'Sparkles',   'earning'),
  ('Assinaturas',  '#DB2777', 'Tag',        'expense'),
  ('Ações',        '#6D28D9', 'TrendingUp', 'investment')
) as missing(name, color, icon, type)
where not exists (
  select 1 from public.categories c
  where c.user_id = u.id and c.name = missing.name
);
