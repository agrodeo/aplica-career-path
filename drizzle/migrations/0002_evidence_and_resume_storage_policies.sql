-- Files are stored under "<user_id>/..." so each user only reads their own.
CREATE POLICY "own evidence readable" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'application-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own resumes readable" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own resumes writable" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "admins read evidence" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('application-evidence','resumes') AND public.has_role(auth.uid(),'admin'));