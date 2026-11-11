-- A user's corrections to subscriptions found in email, and recurring payments added by hand.
create table public.subscription_edits (
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_key text not null,
  merchant text,
  amount numeric(12, 2) check (amount is null or (amount > 0 and amount <= 100000)),
  currency text check (currency is null or currency in ('USD', 'EUR', 'GBP')),
  cadence text check (cadence is null or cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_charge_date date,
  manual boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant_key)
);

alter table public.subscription_edits enable row level security;
revoke all on public.subscription_edits from anon;
grant select, insert, update, delete on public.subscription_edits to authenticated;
create policy "subscription_edits_owner" on public.subscription_edits
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
