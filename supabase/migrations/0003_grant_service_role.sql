-- Service role needs INSERT/UPDATE/DELETE on every table the webhook handler
-- and Inngest functions write to. Supabase's defaults didn't carry these for
-- this project, so grant explicitly + set defaults for future tables.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
