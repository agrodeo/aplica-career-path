-- One transaction saves the user-confirmed profile and preferences. No service
-- credential is exposed to the SPA; SECURITY INVOKER retains every RLS policy.
CREATE OR REPLACE FUNCTION public.save_onboarding_profile(_data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _user uuid := auth.uid();
  _profile jsonb := _data->'profile';
  _selected jsonb := _data->'selected';
  _existing uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF coalesce(_data->>'confirmed','false') <> 'true' THEN RAISE EXCEPTION 'Confirmá la información del perfil'; END IF;
  IF nullif(trim(_profile->>'firstName'),'') IS NULL OR nullif(trim(_profile->>'lastName'),'') IS NULL OR nullif(trim(_profile->>'email'),'') IS NULL THEN
    RAISE EXCEPTION 'Completá nombre, apellido y email';
  END IF;
  INSERT INTO public.profiles(user_id,first_name,last_name,email,phone,city,country,current_title,master_profile_version)
  VALUES(_user,trim(_profile->>'firstName'),trim(_profile->>'lastName'),trim(_profile->>'email'),_profile->>'phone',_profile->>'city',_profile->>'country',_profile->>'role',1)
  ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,
    city=excluded.city,country=excluded.country,current_title=excluded.current_title,master_profile_version=profiles.master_profile_version+1;

  IF nullif(trim(_profile->>'company'),'') IS NOT NULL AND nullif(trim(_profile->>'role'),'') IS NOT NULL THEN
    SELECT id INTO _existing FROM public.experiences WHERE user_id=_user AND company=_profile->>'company' AND title=_profile->>'role'
      ORDER BY created_at LIMIT 1;
    IF _existing IS NULL THEN
      INSERT INTO public.experiences(user_id,company,title,start_date,end_date,is_current,description,achievements,source,verified_by_user)
      VALUES(_user,_profile->>'company',_profile->>'role',nullif(_profile->>'startDate','')::date,nullif(_profile->>'endDate','')::date,
        coalesce((_profile->>'isCurrent')::boolean,false),_profile->>'description',coalesce(_profile->'achievementList','[]'::jsonb),'manual',true);
    ELSE
      UPDATE public.experiences SET start_date=nullif(_profile->>'startDate','')::date,end_date=nullif(_profile->>'endDate','')::date,
        is_current=coalesce((_profile->>'isCurrent')::boolean,false),description=_profile->>'description',
        achievements=coalesce(_profile->'achievementList','[]'::jsonb),verified_by_user=true WHERE id=_existing;
    END IF;
  END IF;
  IF nullif(trim(_profile->>'institution'),'') IS NOT NULL THEN
    SELECT id INTO _existing FROM public.educations WHERE user_id=_user AND institution=_profile->>'institution'
      AND coalesce(degree,'')=coalesce(_profile->>'degree','') ORDER BY created_at LIMIT 1;
    IF _existing IS NULL THEN
      INSERT INTO public.educations(user_id,institution,degree,field,verified_by_user)
      VALUES(_user,_profile->>'institution',_profile->>'degree',_profile->>'area',true);
    ELSE
      UPDATE public.educations SET field=_profile->>'area',verified_by_user=true WHERE id=_existing;
    END IF;
  END IF;
  INSERT INTO public.skills(user_id,name,verified_by_user)
  SELECT _user,value,true FROM jsonb_array_elements_text(coalesce(_selected->'skills','[]'::jsonb)) WHERE trim(value)<>''
  ON CONFLICT(user_id,name) DO UPDATE SET verified_by_user=true;
  IF nullif(_profile->>'language','') IS NOT NULL AND nullif(_profile->>'level','') IS NOT NULL THEN
    INSERT INTO public.languages(user_id,language,level) VALUES(_user,_profile->>'language',_profile->>'level')
    ON CONFLICT(user_id,language) DO UPDATE SET level=excluded.level;
  END IF;
  INSERT INTO public.job_preferences(user_id,target_roles,target_locations,remote_allowed,hybrid_allowed,onsite_allowed,employment_types,seniority_levels,preferred_industries,minimum_match_score)
  VALUES(_user,
    ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'roles','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'locations','[]'::jsonb))),
    coalesce(_selected->'mode','[]'::jsonb) ? 'Remoto',coalesce(_selected->'mode','[]'::jsonb) ? 'Híbrido',coalesce(_selected->'mode','[]'::jsonb) ? 'Presencial',
    ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'employmentTypes','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'seniority','[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(_selected->'industry','[]'::jsonb))),70)
  ON CONFLICT(user_id) DO UPDATE SET target_roles=excluded.target_roles,target_locations=excluded.target_locations,
    remote_allowed=excluded.remote_allowed,hybrid_allowed=excluded.hybrid_allowed,onsite_allowed=excluded.onsite_allowed,
    employment_types=excluded.employment_types,seniority_levels=excluded.seniority_levels,preferred_industries=excluded.preferred_industries;
  INSERT INTO public.auto_apply_consents(user_id,authorized,authorized_at,revoked_at,terms_version)
  VALUES(_user,coalesce((_data->>'autoApplyAuthorized')::boolean,false),
    CASE WHEN (_data->>'autoApplyAuthorized')::boolean THEN now() END,
    CASE WHEN NOT coalesce((_data->>'autoApplyAuthorized')::boolean,false) THEN now() END,'v1')
  ON CONFLICT(user_id) DO UPDATE SET authorized=excluded.authorized,authorized_at=excluded.authorized_at,revoked_at=excluded.revoked_at,terms_version=excluded.terms_version;
END; $$;
REVOKE ALL ON FUNCTION public.save_onboarding_profile(jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_profile(jsonb) TO authenticated;
