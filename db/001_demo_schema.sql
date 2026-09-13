-- Vision Demo — schema
--
-- A single Supabase project for the public, invite-only demo. Unlike the
-- Kraftshala tool, there is no weekly cadence, no fixed entity registry and no
-- Supabase Auth: access is gated by a one-time invite token, and every table is
-- reached only from the demo app's server routes over the pooled connection.
-- RLS is therefore left off; do NOT expose the anon key to a browser client.

begin;

-- Invite request from aashishkarki.com/projects/vision. `used_at` flips the
-- moment a run starts, which is what enforces one run per invite.
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  token       text unique not null,
  name        text not null,
  email       text not null,
  company     text not null,
  ip          text,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index if not exists invites_email_idx on invites (email);
create index if not exists invites_created_idx on invites (created_at);

-- One demo run per invite. progress is done_units/total_units for the UI.
create table if not exists demo_runs (
  id           uuid primary key default gen_random_uuid(),
  invite_id    uuid not null references invites(id) on delete cascade,
  website      text not null,
  own_brand    text not null,
  competitors  text[] not null default '{}',
  status       text not null default 'pending',   -- pending|running|done|failed
  total_units  int not null default 0,            -- prompts * surfaces
  done_units   int not null default 0,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);
create index if not exists demo_runs_invite_idx on demo_runs (invite_id);
create index if not exists demo_runs_created_idx on demo_runs (created_at);

-- Up to 3 prompts per run (enforced in app code).
create table if not exists demo_prompts (
  id       uuid primary key default gen_random_uuid(),
  run_id   uuid not null references demo_runs(id) on delete cascade,
  ordinal  int not null,
  text     text not null
);
create index if not exists demo_prompts_run_idx on demo_prompts (run_id);

-- One row per (prompt, surface). Its existence marks that unit as collected,
-- so the step engine derives outstanding work from what is missing here — the
-- same resume-safe pattern as the Kraftshala collector.
create table if not exists demo_responses (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references demo_runs(id) on delete cascade,
  prompt_id    uuid not null references demo_prompts(id) on delete cascade,
  surface      text not null,
  raw_text     text,
  no_answer    boolean not null default false,
  citations    jsonb not null default '[]'::jsonb,
  extracted_at timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (run_id, prompt_id, surface)
);
create index if not exists demo_responses_run_idx on demo_responses (run_id);

-- Extracted brand slots per answer. tracked = own brand or a listed competitor;
-- everything else the model named is stored with tracked=false so share-of-voice
-- is measured against the whole conversation, not just the brands they typed.
create table if not exists demo_mentions (
  id                uuid primary key default gen_random_uuid(),
  response_id       uuid not null references demo_responses(id) on delete cascade,
  brand             text not null,
  is_own            boolean not null default false,
  tracked           boolean not null default false,
  ordinal_position  int
);
create index if not exists demo_mentions_response_idx on demo_mentions (response_id);

-- "Requested for Setup (Tried Demo)" captures, from the WhatsApp click or the
-- get-in-touch popup.
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  company     text,
  phone       text,
  source      text not null,          -- whatsapp|form
  run_id      uuid references demo_runs(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists leads_created_idx on leads (created_at);

commit;
