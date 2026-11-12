-- Allow "every 6 months" as a billing cycle on user edits.
alter table public.subscription_edits drop constraint if exists subscription_edits_cadence_check;
alter table public.subscription_edits
  add constraint subscription_edits_cadence_check
  check (cadence is null or cadence in ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly'));
