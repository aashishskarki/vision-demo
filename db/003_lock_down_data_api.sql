-- Vision Demo — migration 003: close the tables to Supabase's Data API
--
-- Supabase grants the anon and authenticated roles full access to every table
-- in `public` and serves them over the auto-generated REST API. With RLS off,
-- anyone holding the project's anon key could read or rewrite invites (tokens,
-- names, emails, IPs) and leads. The demo app never uses that API: it connects
-- as `postgres` over the pooler, which owns the tables and bypasses RLS.
--
-- So: RLS on with no policies (deny-all for API roles), and the grants removed.
-- Any table added later needs the same two statements.

begin;

alter table invites        enable row level security;
alter table demo_runs      enable row level security;
alter table demo_prompts   enable row level security;
alter table demo_responses enable row level security;
alter table demo_mentions  enable row level security;
alter table leads          enable row level security;

revoke all on table
  invites, demo_runs, demo_prompts, demo_responses, demo_mentions, leads
from anon, authenticated;

commit;
