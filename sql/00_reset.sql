-- Drops everything Glass Wall created, so setup can run again from scratch.
-- Run as the setup user. Safe to run on an empty database.
DROP SCHEMA IF EXISTS raw, vault, agent, agent_open, audit CASCADE;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['gw_agent_wall','gw_agent_open','gw_writer','gw_admin','gw_owner'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('DROP OWNED BY %I', r);
      EXECUTE format('DROP ROLE %I', r);
    END IF;
  END LOOP;
END $$;
