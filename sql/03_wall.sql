-- The wall: tokenizing view for agents, unmasked baseline view, grants.
-- The salt is read from vault.salt at query time (never written into a view
-- body, which any role can read via pg_views). Tokenization is inline, not a
-- function, because function EXECUTE is checked against the caller and would
-- give agents a dictionary-attack oracle.
SET ROLE gw_owner;

CREATE VIEW agent.customers_v WITH (security_barrier = true) AS
SELECT
  c.customer_id,
  'tok_' || left(encode(sha256(convert_to(s.salt || '|name|'  || lower(trim(c.full_name)), 'UTF8')), 'hex'), 8) AS full_name,
  'tok_' || left(encode(sha256(convert_to(s.salt || '|email|' || lower(trim(c.email)),     'UTF8')), 'hex'), 8) AS email,
  'tok_' || left(encode(sha256(convert_to(s.salt || '|phone|' || right(regexp_replace(c.phone, '\D', '', 'g'), 10), 'UTF8')), 'hex'), 8) AS phone,
  c.city,
  c.plan_tier,
  c.monthly_spend,
  c.signup_date,
  regexp_replace(
    regexp_replace(c.notes, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
    '(\+\d{1,3}[\s-]?)?\d([\s-]?\d){9}', '[phone]', 'g') AS notes
FROM raw.customers c
CROSS JOIN vault.salt s;

CREATE VIEW agent_open.customers_v WITH (security_barrier = true) AS
SELECT customer_id, full_name, email, phone, city, plan_tier, monthly_spend, signup_date, notes
FROM raw.customers;

GRANT USAGE  ON SCHEMA agent      TO gw_agent_wall;
GRANT SELECT ON agent.customers_v TO gw_agent_wall;
GRANT USAGE  ON SCHEMA agent_open      TO gw_agent_open;
GRANT SELECT ON agent_open.customers_v TO gw_agent_open;

GRANT USAGE  ON SCHEMA raw, audit TO gw_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA raw, audit TO gw_admin;
GRANT UPDATE (review) ON audit.outbox TO gw_admin;

GRANT USAGE ON SCHEMA audit TO gw_writer;
GRANT SELECT, INSERT ON audit.events, audit.outbox, audit.results TO gw_writer;
GRANT UPDATE (review) ON audit.outbox TO gw_writer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA audit TO gw_writer;

RESET ROLE;
