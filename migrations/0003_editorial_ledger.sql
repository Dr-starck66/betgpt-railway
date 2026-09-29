-- Durable editorial ledger for scheduled/public Discover-oriented articles.
create table if not exists editorial_articles (
  id text primary key,
  paris_date text not null,
  slot text not null,
  status text not null,
  published_at timestamptz,
  modified_at timestamptz,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists editorial_articles_paris_date on editorial_articles (paris_date desc);
create index if not exists editorial_articles_published_at on editorial_articles (published_at desc);
