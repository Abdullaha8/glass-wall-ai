-- Phase 5: token usage per run, to measure free-tier budgets. Idempotent.
SET ROLE gw_owner;
ALTER TABLE audit.results ADD COLUMN IF NOT EXISTS tokens_in  integer;
ALTER TABLE audit.results ADD COLUMN IF NOT EXISTS tokens_out integer;
RESET ROLE;
