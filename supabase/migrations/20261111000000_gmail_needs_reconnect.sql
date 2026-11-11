-- Set when Google refuses the stored refresh token (invalid_grant: expired or revoked).
-- The connection row and the user's records stay; the dashboard asks them to reconnect.
alter table public.gmail_connections
  add column needs_reconnect boolean not null default false;
