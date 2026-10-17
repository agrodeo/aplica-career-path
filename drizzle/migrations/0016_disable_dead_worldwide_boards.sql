update public.companies
set active = false
where ats_type = 'greenhouse'
  and ats_identifier in ('woox','woofi1');
