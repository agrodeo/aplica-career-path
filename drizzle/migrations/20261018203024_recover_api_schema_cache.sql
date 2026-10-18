-- PostgREST builds its schema cache as authenticator, before switching to a
-- request role. Allow that initialization the same bounded budget as workers.
-- anon (3s) and authenticated (8s) retain their explicit per-role limits.
ALTER ROLE authenticator SET statement_timeout = '30s';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
