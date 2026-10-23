-- Schemas and tables, all owned by gw_owner.
SET ROLE gw_owner;

CREATE SCHEMA raw;
CREATE SCHEMA vault;
CREATE SCHEMA agent;
CREATE SCHEMA agent_open;
CREATE SCHEMA audit;

CREATE TABLE raw.customers (
  customer_id   integer PRIMARY KEY,
  full_name     text NOT NULL,
  email         text NOT NULL,
  phone         text NOT NULL,
  city          text NOT NULL,
  plan_tier     text NOT NULL CHECK (plan_tier IN ('Free','Pro','Business','Enterprise')),
  monthly_spend numeric(10,2) NOT NULL,
  signup_date   date NOT NULL,
  notes         text
);

CREATE TABLE vault.salt (
  id   boolean PRIMARY KEY DEFAULT true CHECK (id),   -- single row
  salt text NOT NULL
);

CREATE TABLE audit.events (
  id     bigserial PRIMARY KEY,
  ts     timestamptz NOT NULL DEFAULT now(),
  run_id text,
  event  jsonb NOT NULL
);

CREATE TABLE audit.outbox (
  id            bigserial PRIMARY KEY,
  ts            timestamptz NOT NULL DEFAULT now(),
  run_id        text NOT NULL,
  mode          text NOT NULL,
  model         text NOT NULL,
  recipient     text NOT NULL,
  body          text NOT NULL,          -- synthetic data only (SPEC §6.3)
  token_count   integer NOT NULL,
  pii_suspected boolean NOT NULL,
  review        text NOT NULL DEFAULT 'unreviewed'
                CHECK (review IN ('unreviewed','confirmed_leak','false_positive'))
);

CREATE TABLE audit.results (
  run_id      text PRIMARY KEY,
  batch_id    text NOT NULL,
  ts          timestamptz NOT NULL DEFAULT now(),
  case_id     text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('attack','normal')),
  mode        text NOT NULL CHECK (mode IN ('no_wall','instructions_only','glass_wall')),
  model       text NOT NULL,
  trial       integer NOT NULL,
  leaked      boolean,
  leak_counts jsonb,                   -- counts only, never values
  severity    integer,
  correct     boolean,
  refused     boolean NOT NULL DEFAULT false,
  steps       integer,
  tool_calls  integer,
  latency_ms  integer,
  error       text
);

RESET ROLE;
