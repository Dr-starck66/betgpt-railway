-- Durable BetGPT store (unowned rows — auth remains OFF).
create table if not exists kv (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists analytics_events (
  id bigserial primary key,
  t timestamptz not null default now(),
  e text not null,
  p text,
  route text
);
create index if not exists analytics_events_e_t on analytics_events (e, t desc);

create table if not exists affiliate_clicks (
  id bigserial primary key,
  t timestamptz not null default now(),
  book text not null,
  match_id text,
  href text
);

create table if not exists rate_hits (
  k text not null,
  t bigint not null
);
create index if not exists rate_hits_k_t on rate_hits (k, t);
