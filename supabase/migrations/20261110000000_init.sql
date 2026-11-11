-- Subwatch per-user storage. Every table is owned by an auth user and locked
-- down with row level security: a user can only see and write their own rows.

create table public.records (
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id text not null,
  email_date timestamptz,
  data jsonb not null,
  primary key (user_id, email_id)
);

create table public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gmail_email text not null,
  enc_tokens text not null,
  last_sync_epoch bigint
);

create table public.dismissed (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.manual_cancels (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.paid (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table public.reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.records enable row level security;
create policy "records_owner" on public.records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.gmail_connections enable row level security;
create policy "gmail_connections_owner" on public.gmail_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.dismissed enable row level security;
create policy "dismissed_owner" on public.dismissed
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.manual_cancels enable row level security;
create policy "manual_cancels_owner" on public.manual_cancels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.paid enable row level security;
create policy "paid_owner" on public.paid
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.reminders enable row level security;
create policy "reminders_owner" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
