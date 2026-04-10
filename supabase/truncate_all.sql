DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        IF r.tablename NOT IN ('schema_migrations', 'supabase_migrations') THEN
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END IF;
    END LOOP;
END $$;
