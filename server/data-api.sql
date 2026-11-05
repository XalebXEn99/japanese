DO $migration$
BEGIN
  ALTER TABLE public.app_progress ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.app_progress FORCE ROW LEVEL SECURITY;
  ALTER TABLE public.app_progress ALTER COLUMN user_id SET DEFAULT (auth.user_id());

  CREATE OR REPLACE FUNCTION public.guard_progress_write()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = pg_catalog
  AS $guard$
  BEGIN
    IF NEW.progress->'version' IS DISTINCT FROM '1'::jsonb
      OR jsonb_typeof(NEW.progress->'updatedAt') IS DISTINCT FROM 'string'
      OR jsonb_typeof(NEW.progress->'cards') IS DISTINCT FROM 'object'
      OR jsonb_typeof(NEW.progress->'units') IS DISTINCT FROM 'object'
      OR jsonb_typeof(NEW.progress->'stats') IS DISTINCT FROM 'object'
      OR jsonb_typeof(NEW.progress->'settings') IS DISTINCT FROM 'object'
      OR (NEW.progress ? 'challenges' AND jsonb_typeof(NEW.progress->'challenges') IS DISTINCT FROM 'object')
      OR (NEW.progress ? 'activity' AND jsonb_typeof(NEW.progress->'activity') IS DISTINCT FROM 'object')
      OR NEW.progress - ARRAY['version','updatedAt','cards','units','stats','settings','challenges','activity'] <> '{}'::jsonb
    THEN
      RAISE EXCEPTION 'Invalid progress snapshot' USING ERRCODE = '22023';
    END IF;
    IF octet_length(NEW.progress::text) > 1048576 THEN
      RAISE EXCEPTION 'Progress exceeds 1 MB' USING ERRCODE = '22023';
    END IF;
    IF (TG_OP = 'INSERT' AND NEW.revision <> 1)
      OR (TG_OP = 'UPDATE' AND NEW.revision <> OLD.revision + 1)
    THEN
      RAISE EXCEPTION 'Invalid progress revision' USING ERRCODE = '22023';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $guard$;

  CREATE OR REPLACE TRIGGER app_progress_write_guard
    BEFORE INSERT OR UPDATE ON public.app_progress
    FOR EACH ROW EXECUTE FUNCTION public.guard_progress_write();

  DROP POLICY IF EXISTS app_progress_owner ON public.app_progress;
  CREATE POLICY app_progress_owner ON public.app_progress
    FOR ALL TO authenticated
    USING (user_id = (SELECT auth.user_id()))
    WITH CHECK (user_id = (SELECT auth.user_id()));

  REVOKE ALL ON public.app_progress FROM PUBLIC, anonymous, authenticated;
  GRANT USAGE ON SCHEMA public, auth TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
  GRANT SELECT (user_id, progress, revision) ON public.app_progress TO authenticated;
  GRANT INSERT (progress, revision) ON public.app_progress TO authenticated;
  GRANT UPDATE (progress, revision) ON public.app_progress TO authenticated;
  REVOKE EXECUTE ON FUNCTION public.guard_progress_write() FROM PUBLIC, anonymous, authenticated;
END;
$migration$;
