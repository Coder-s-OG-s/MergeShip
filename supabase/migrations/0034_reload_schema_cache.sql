-- Force PostgREST to reload its schema cache to detect newly created tables/columns.
NOTIFY pgrst, 'reload schema';
