-- OmniFlow migration 001 — initial schema for accounts, categories, transactions.
-- Money is bigint cents end-to-end. RLS is enabled on every table from this migration.
-- Paste this whole file into the Supabase dashboard SQL Editor and run once.

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- accounts

create table public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('credit_card','debit','voucher','brokerage','cash','savings')),
  short_name  text,
  last4       text,
  color       text,
  icon        text,
  balance_cents bigint not null default 0,
  currency    text not null default 'BRL',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index accounts_user_id_idx on public.accounts (user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

create policy "accounts_select_own"
  on public.accounts for select
  using (auth.uid() = user_id);

create policy "accounts_insert_own"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "accounts_update_own"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "accounts_delete_own"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- categories

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  icon       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_user_id_idx on public.categories (user_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "categories_insert_own"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "categories_update_own"
  on public.categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories_delete_own"
  on public.categories for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- transactions
-- amount_cents is always positive; sign is implied by `type`.

create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         text not null check (type in ('expense','earning','investment')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency     text not null default 'BRL',
  account_id   uuid not null references public.accounts(id) on delete restrict,
  category_id  uuid references public.categories(id) on delete set null,
  date         date not null,
  description  text not null,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index transactions_user_date_idx
  on public.transactions (user_id, date desc)
  where deleted_at is null;

create index transactions_account_date_idx
  on public.transactions (account_id, date desc);

create index transactions_category_idx
  on public.transactions (category_id)
  where deleted_at is null;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- New-user seed: 6 default categories + 1 starter account.
-- Runs as `security definer` so the trigger can insert on behalf of the new
-- user before their auth context is established.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (user_id, name, type, short_name, color, icon, currency)
  values (new.id, 'Conta Principal', 'debit', 'Principal', '#FACC15', 'Wallet', 'BRL');

  insert into public.categories (user_id, name, color, icon) values
    (new.id, 'Mercado',      '#15803D', 'ShoppingBag'),
    (new.id, 'Aluguel',      '#0EA5E9', 'Home'),
    (new.id, 'Salário',      '#15803D', 'Briefcase'),
    (new.id, 'Restaurantes', '#EA580C', 'Coffee'),
    (new.id, 'Transporte',   '#A16207', 'Car'),
    (new.id, 'Contas',       '#0891B2', 'Bolt');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
