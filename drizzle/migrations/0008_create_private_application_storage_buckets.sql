insert into storage.buckets (id, name, public)
values
  ('resumes','resumes',false),
  ('application-evidence','application-evidence',false)
on conflict (id) do update set public = false;
