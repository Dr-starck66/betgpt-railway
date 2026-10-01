-- ASTRA SEARCH TRUTH Ω
-- Exact organic landing evidence. No IPs, no search-query guessing, no user identifiers.
create table if not exists search_truth_landings (
  id bigserial primary key,
  t timestamptz not null default now(),
  source text not null,
  route text not null
);
create index if not exists search_truth_landings_t on search_truth_landings (t desc);
create index if not exists search_truth_landings_source_t on search_truth_landings (source, t desc);
create index if not exists search_truth_landings_route_t on search_truth_landings (route, t desc);
