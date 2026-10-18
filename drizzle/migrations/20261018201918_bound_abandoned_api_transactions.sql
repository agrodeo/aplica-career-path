-- Background inventory and inspection work is bounded but can exceed the
-- authenticator's 8-second default during concurrent imports. Public user
-- roles retain their own limits. The worker's HTTP deadline stays above this.
ALTER ROLE service_role SET statement_timeout = '30s';
-- A disconnected API client must not hold an unfinished transaction forever.
ALTER ROLE authenticator SET idle_in_transaction_session_timeout = '30s';
NOTIFY pgrst, 'reload config';
