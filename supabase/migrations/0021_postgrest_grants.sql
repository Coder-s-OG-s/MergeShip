-- PostgREST (Supabase API) requires explicit table grants in addition to RLS.
-- Without these, middleware cannot read github_installations and every signed-in
-- user is stuck on /install even when seed data includes a mock installation.

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to postgres, service_role;
grant usage, select on all sequences in schema public to authenticated, anon;
