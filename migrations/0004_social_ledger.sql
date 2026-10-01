-- ASTRA SOCIAL durable queue / proof ledger.
create table if not exists social_publications (
  id text primary key,
  article_id text not null,
  network text not null,
  status text not null,
  published_at timestamptz,
  remote_id text,
  remote_url text,
  retry_count integer not null default 0,
  error text,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  unique (article_id, network)
);
create index if not exists social_publications_article_id on social_publications (article_id);
create index if not exists social_publications_status on social_publications (status);
create index if not exists social_publications_updated_at on social_publications (updated_at desc);
