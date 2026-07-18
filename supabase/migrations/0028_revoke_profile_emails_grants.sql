-- Revoke table-level permissions from authenticated and anon roles for profile_emails
-- This fixes the over-provisioned grants introduced in 0026_profile_emails_grants.sql

REVOKE ALL ON TABLE public.profile_emails FROM authenticated;
REVOKE ALL ON TABLE public.profile_emails FROM anon;
