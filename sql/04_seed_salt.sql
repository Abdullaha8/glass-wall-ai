-- Store the tokenization salt. Changing it changes every token.
SET ROLE gw_owner;
INSERT INTO vault.salt (salt) VALUES (:'salt')
ON CONFLICT (id) DO UPDATE SET salt = EXCLUDED.salt;
RESET ROLE;
