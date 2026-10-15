GRANT INSERT, UPDATE, DELETE ON public.job_matches TO authenticated;

CREATE POLICY "own matches insert"
ON public.job_matches FOR INSERT TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "own matches update"
ON public.job_matches FOR UPDATE TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "own matches delete"
ON public.job_matches FOR DELETE TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "application schemas readable"
ON public.application_schemas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = application_schemas.job_id
      AND j.is_active = true
  )
);
