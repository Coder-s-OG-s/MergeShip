-- Migration 0026: Explicit grants for profile_emails table
-- Fixes permission denied errors for service_role and other roles
-- since the table was created after the blanket grants in 0021_postgrest_grants.sql

GRANT ALL ON TABLE public.profile_emails TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_emails TO authenticated;
GRANT SELECT ON TABLE public.profile_emails TO anon;
