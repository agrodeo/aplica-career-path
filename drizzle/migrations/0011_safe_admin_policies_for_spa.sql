CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (select auth.uid())
      AND role = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "admins manage companies" ON public.companies;
CREATE POLICY "admins manage companies" ON public.companies FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins manage sources" ON public.job_sources;
CREATE POLICY "admins manage sources" ON public.job_sources FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins read all jobs" ON public.jobs;
CREATE POLICY "admins read all jobs" ON public.jobs FOR SELECT TO authenticated
USING ((select public.is_admin()));

DROP POLICY IF EXISTS "admins manage jobs" ON public.jobs;
CREATE POLICY "admins manage jobs" ON public.jobs FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins manage schemas" ON public.application_schemas;
CREATE POLICY "admins manage schemas" ON public.application_schemas FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins manage adapters" ON public.adapter_registry;
CREATE POLICY "admins manage adapters" ON public.adapter_registry FOR ALL TO authenticated
USING ((select public.is_admin())) WITH CHECK ((select public.is_admin()));

DROP POLICY IF EXISTS "admins read inspections" ON public.adapter_inspections;
CREATE POLICY "admins read inspections" ON public.adapter_inspections FOR SELECT TO authenticated
USING ((select public.is_admin()));

DROP POLICY IF EXISTS "admins create inspections" ON public.adapter_inspections;
CREATE POLICY "admins create inspections" ON public.adapter_inspections FOR INSERT TO authenticated
WITH CHECK ((select public.is_admin()) AND (select auth.uid()) = requested_by);

DROP POLICY IF EXISTS "admins read evidence" ON storage.objects;
CREATE POLICY "admins read evidence" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('application-evidence','resumes') AND (select public.is_admin()));
