-- A user's chosen category for a merchant, overriding the built-in rules.
create table public.merchant_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  category text not null check (category in ('housing', 'utilities', 'phone', 'software', 'streaming', 'music', 'gaming', 'storage', 'shopping', 'learning', 'health', 'insurance', 'other')),
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

alter table public.merchant_categories enable row level security;
revoke all on public.merchant_categories from anon;
grant select, insert, update, delete on public.merchant_categories to authenticated;
create policy "merchant_categories_owner" on public.merchant_categories
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
