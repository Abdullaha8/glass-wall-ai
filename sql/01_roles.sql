-- Roles. Run as superuser (local) or the Neon owner user.
-- Password variables use psql syntax (colon + quoted name); python -m glasswall.setup_db fills them in.
CREATE ROLE gw_owner NOLOGIN;
CREATE ROLE gw_admin      LOGIN PASSWORD :'admin_pw';
CREATE ROLE gw_agent_wall LOGIN PASSWORD :'wall_pw';
CREATE ROLE gw_agent_open LOGIN PASSWORD :'open_pw';
CREATE ROLE gw_writer     LOGIN PASSWORD :'writer_pw';

-- Lets the setup user create objects owned by gw_owner
GRANT gw_owner TO CURRENT_USER;
DO $$ BEGIN
  EXECUTE format('GRANT CREATE, CONNECT ON DATABASE %I TO gw_owner', current_database());
END $$;

-- Agent roles: read-only, short queries, each sees only its own schema
ALTER ROLE gw_agent_wall SET search_path = agent;
ALTER ROLE gw_agent_open SET search_path = agent_open;
ALTER ROLE gw_agent_wall SET default_transaction_read_only = on;
ALTER ROLE gw_agent_open SET default_transaction_read_only = on;
ALTER ROLE gw_agent_wall SET statement_timeout = '5s';
ALTER ROLE gw_agent_open SET statement_timeout = '5s';

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
