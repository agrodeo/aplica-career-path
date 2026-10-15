CREATE POLICY "admins read attempts"
ON public.application_attempts
FOR SELECT TO authenticated
USING ((select public.is_admin()));
