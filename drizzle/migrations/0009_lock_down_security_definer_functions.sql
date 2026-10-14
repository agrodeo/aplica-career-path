revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;

revoke execute on function public.enqueue_application(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.enqueue_application(uuid,uuid,uuid,integer) to service_role;

revoke execute on function public.claim_application(text,integer) from public, anon, authenticated;
grant execute on function public.claim_application(text,integer) to service_role;

revoke execute on function public.complete_application(uuid,text,text) from public, anon, authenticated;
grant execute on function public.complete_application(uuid,text,text) to service_role;

revoke execute on function public.retry_application(uuid,integer,text,text) from public, anon, authenticated;
grant execute on function public.retry_application(uuid,integer,text,text) to service_role;

revoke execute on function public.fail_application(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.fail_application(uuid,text,text,text) to service_role;

revoke execute on function public.update_attempt_status(uuid,text) from public, anon, authenticated;
grant execute on function public.update_attempt_status(uuid,text) to service_role;

revoke execute on function public.claim_inspection(text,integer) from public, anon, authenticated;
grant execute on function public.claim_inspection(text,integer) to service_role;
