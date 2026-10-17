import { supabase } from "@/integrations/supabase/client";

const TITLE_NOISE = new Set([
  "senior","sr","junior","jr","lead","principal","staff","head","associate","intern","internship",
  "remote","latam","global","the","and","of","de","del","la","el","y",
]);

function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

function words(value: string, removeNoise = false) {
  return new Set(normalizeText(value).split(" ").filter((word) => word.length > 1 && (!removeNoise || !TITLE_NOISE.has(word))));
}

function similarity(a: string, b: string) {
  const left = words(a, true);
  const right = words(b, true);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const precision = intersection / left.size;
  const recall = intersection / right.size;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return Math.min(100, Math.max(Math.round(f1 * 85), na.includes(nb) || nb.includes(na) ? 92 : 0));
}

function includesLoose(haystack: string | null | undefined, needle: string | null | undefined) {
  if (!haystack || !needle) return false;
  const a = normalizeText(haystack);
  const b = normalizeText(needle);
  return a.includes(b) || b.includes(a);
}

function normalizeMode(value: string | null) {
  const mode = (value ?? "").toLowerCase();
  if (/remote|remoto/.test(mode)) return "remote";
  if (/hybrid|hibr|híbr/.test(mode)) return "hybrid";
  if (/onsite|on-site|presencial|office/.test(mode)) return "onsite";
  return "unknown";
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sesión no válida.");
  return data.user.id;
}

type StoredField = {
  label?: string;
  answerKey?: string;
  canonicalKey?: string | null;
  type?: string;
  required?: boolean;
  options?: Array<{ label?: string; value?: string }>;
  demographic?: boolean;
};

export type MissingApplicationQuestion = {
  answerKey: string;
  label: string;
  fieldType: string;
  answerType: "boolean" | "text" | "numeric";
  options: Array<{ label: string; value: string }>;
};

function hasDeclineOption(options?: StoredField["options"]) {
  return (options ?? []).some((option) => /decline|prefer not|do not wish|no deseo|prefiero no/i.test(option.label ?? ""));
}

function isBooleanOptions(options?: StoredField["options"]) {
  const labels = (options ?? []).flatMap((option) => [option.label ?? "", option.value ?? ""]).map((x) => x.trim().toLowerCase());
  return labels.some((x) => /^(yes|sí|si|true)$/.test(x)) && labels.some((x) => /^(no|false)$/.test(x));
}

async function applicationReadiness(userId: string, jobs: Array<{ id: string; application_schema_id: string | null }>) {
  const result = new Map<string, MissingApplicationQuestion[]>();
  for (const job of jobs) result.set(job.id, []);
  const schemaIds = jobs.map((job) => job.application_schema_id).filter((id): id is string => Boolean(id));
  if (!jobs.length) return result;

  const [{ data: profile }, { data: experiences }, { data: answers }, { data: schemas }] = await Promise.all([
    supabase.from("profiles").select("first_name,last_name,email,phone,city,country,linkedin_url,portfolio_url,current_title,professional_summary,base_resume_path").eq("user_id", userId).maybeSingle(),
    supabase.from("experiences").select("company,title,achievements").eq("user_id", userId).limit(5),
    supabase.from("application_answers").select("canonical_key,answer_type,boolean_value,text_value,numeric_value,user_confirmed").eq("user_id", userId).eq("user_confirmed", true),
    schemaIds.length
      ? supabase.from("application_schemas").select("id,job_id,fields,valid").in("id", schemaIds).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  const confirmed = new Set((answers ?? []).map((answer) => answer.canonical_key));
  const answerByKey = new Map((answers ?? []).map((answer) => [answer.canonical_key, answer]));
  const currentExperience = experiences?.[0] ?? null;
  const schemaById = new Map((schemas ?? []).map((schema) => [schema.id, schema]));

  const covered = (key: string) => {
    switch (key) {
      case "first_name": return Boolean(profile?.first_name);
      case "last_name": return Boolean(profile?.last_name);
      case "full_name": return Boolean(profile?.first_name && profile?.last_name);
      case "email": return Boolean(profile?.email);
      case "phone": return Boolean(profile?.phone);
      case "location": return Boolean(profile?.city || profile?.country);
      case "country": return Boolean(profile?.country);
      case "linkedin": return Boolean(profile?.linkedin_url);
      case "portfolio":
      case "website": return Boolean(profile?.portfolio_url);
      case "current_company": return Boolean(currentExperience?.company);
      case "current_title": return Boolean(profile?.current_title || currentExperience?.title);
      case "years_experience": return Boolean(experiences?.length);
      case "resume": return Boolean(profile?.first_name && profile?.last_name && (profile?.current_title || experiences?.length || profile?.base_resume_path));
      case "cover_letter":
      case "about_you": return Boolean(profile?.professional_summary || experiences?.length);
      default: return confirmed.has(key);
    }
  };

  for (const job of jobs) {
    const missing: MissingApplicationQuestion[] = [];
    const schema = job.application_schema_id ? schemaById.get(job.application_schema_id) : null;
    if (!schema?.valid) {
      missing.push({ answerKey: "system:application_schema", label: "La vacante necesita volver a verificarse antes de aplicar.", fieldType: "system", answerType: "text", options: [] });
      result.set(job.id, missing);
      continue;
    }

    const fields = Array.isArray(schema.fields) ? schema.fields as StoredField[] : [];
    for (const field of fields) {
      if (!field.required) continue;
      if (field.demographic && hasDeclineOption(field.options)) continue;
      const canonicalKey = field.canonicalKey ?? null;
      const answerKey = (field.answerKey ?? canonicalKey ?? "").trim();
      if (!answerKey) continue;

      if (field.type === "checkbox") {
        const saved = answerByKey.get(answerKey);
        if (saved?.answer_type === "boolean" && saved.boolean_value === true) continue;
      } else if ((canonicalKey && covered(canonicalKey)) || (!canonicalKey && confirmed.has(answerKey))) {
        continue;
      }

      if (field.type === "file" || field.type === "unknown") continue;
      const options = (field.options ?? []).map((option) => ({
        label: String(option.label ?? "").trim(),
        value: String(option.value ?? "").trim(),
      })).filter((option) => option.label && option.value);

      missing.push({
        answerKey,
        label: (field.label ?? answerKey).replace(/\s*\*\s*$/, "").trim(),
        fieldType: field.type ?? "text",
        answerType: field.type === "checkbox" || (field.type === "radio" && isBooleanOptions(field.options))
          ? "boolean"
          : canonicalKey === "years_experience" ? "numeric" : "text",
        options,
      });
    }
    result.set(job.id, missing);
  }
  return result;
}

export async function refreshJobMatches() {
  const userId = await currentUserId();
  const [profile, experiences, skills, preferences] = await Promise.all([
    supabase.from("profiles").select("current_title,city,country,professional_summary").eq("user_id", userId).maybeSingle(),
    supabase.from("experiences").select("title").eq("user_id", userId),
    supabase.from("skills").select("name").eq("user_id", userId),
    supabase.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  // Only match jobs that passed structural Auto Apply inspection. Page through
  // the inventory instead of silently truncating at PostgREST's first 1,000 rows.
  const jobs: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    country: string | null;
    remote_type: string | null;
    employment_type: string | null;
    seniority: string | null;
  }> = [];
  const PAGE_SIZE = 1000;
  const MAX_MATCH_INVENTORY = 10000;
  for (let offset = 0; offset < MAX_MATCH_INVENTORY; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,description,location,country,remote_type,employment_type,seniority")
      .eq("is_active", true)
      .eq("auto_apply_eligible", true)
      .order("discovered_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    jobs.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const pref = preferences.data;
  const targetRoles = pref?.target_roles ?? [];
  const experienceTitles = [profile.data?.current_title ?? "", ...(experiences.data ?? []).map((x) => x.title)].filter(Boolean);
  const roleCandidates = [...targetRoles, ...experienceTitles];
  const userSkills = (skills.data ?? []).map((x) => x.name).filter(Boolean);
  const targetLocations = pref?.target_locations ?? [];

  const rows = jobs.map((job) => {
    const roleScore = roleCandidates.length ? Math.max(...roleCandidates.map((role) => similarity(role, job.title))) : 50;
    const text = `${job.title} ${job.description ?? ""}`;
    const matchedSkills = userSkills.filter((skill) => includesLoose(text, skill));
    const skillsScore = userSkills.length ? Math.min(100, Math.round((matchedSkills.length / Math.min(userSkills.length, 8)) * 100)) : 55;
    const mode = normalizeMode(job.remote_type);
    const modeAllowed = mode === "remote" ? pref?.remote_allowed !== false : mode === "hybrid" ? pref?.hybrid_allowed !== false : mode === "onsite" ? pref?.onsite_allowed === true : true;
    const locationMatched = mode === "remote" || !targetLocations.length || targetLocations.some((location) => includesLoose(job.location, location) || includesLoose(job.country, location));
    const locationScore = locationMatched ? 100 : 30;
    const hardRequirementsMet = modeAllowed && (roleCandidates.length === 0 || roleScore >= 30) && (locationMatched || pref?.willing_to_relocate === true);
    const matchScore = Math.round(Math.max(0, Math.min(100, roleScore * 0.55 + skillsScore * 0.25 + locationScore * 0.2)));
    return {
      user_id: userId,
      job_id: job.id,
      match_score: matchScore,
      role_score: roleScore,
      skills_score: skillsScore,
      experience_score: roleScore,
      location_score: locationScore,
      seniority_score: 70,
      preferences_score: 70,
      hard_requirements_met: hardRequirementsMet,
      explanation: {
        matchedSkills,
        targetRole: targetRoles[0] ?? profile.data?.current_title ?? null,
        mode: job.remote_type,
        location: job.location,
        hardRequirementChecks: { roleRelevant: roleScore >= 30, modeAllowed, locationRequirementMet: locationMatched },
        note: "El match compara perfil y vacante; no es una probabilidad de contratación.",
      },
      created_at: new Date().toISOString(),
    };
  });

  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const { error } = await supabase.from("job_matches").upsert(batch, { onConflict: "user_id,job_id" });
    if (error) throw new Error(error.message);
  }
  return { matched: rows.length };
}

export async function listAutoApplyJobs() {
  const userId = await currentUserId();
  const [{ data: preferences }, { data: verifiedAttempts }, { data: queuedApplications }] = await Promise.all([
    supabase.from("job_preferences").select("minimum_match_score").eq("user_id", userId).maybeSingle(),
    supabase.from("application_attempts").select("job_id").eq("user_id", userId).eq("status", "verified"),
    supabase.from("application_queue").select("job_id").eq("user_id", userId),
  ]);
  const minimum = Number(preferences?.minimum_match_score ?? 70);
  const unavailable = new Set([...(verifiedAttempts ?? []).map((x) => x.job_id), ...(queuedApplications ?? []).map((x) => x.job_id)]);

  const matches: Array<Record<string, any>> = [];
  const PAGE_SIZE = 1000;
  const MAX_VISIBLE_MATCHES = 5000;
  for (let offset = 0; offset < MAX_VISIBLE_MATCHES; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("job_matches")
      .select("*")
      .eq("user_id", userId)
      .eq("hard_requirements_met", true)
      .gte("match_score", minimum)
      .order("match_score", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    matches.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const filteredMatches = matches.filter((match) => !unavailable.has(String(match.job_id)));
  const matchByJob = new Map(filteredMatches.map((match) => [String(match.job_id), match]));
  const jobIds = [...matchByJob.keys()];
  const jobs: Array<Record<string, any>> = [];

  for (let offset = 0; offset < jobIds.length; offset += 300) {
    const ids = jobIds.slice(offset, offset + 300);
    const { data, error } = await supabase
      .from("jobs")
      .select("id,title,location,remote_type,employment_type,seniority,salary_min,salary_max,salary_currency,published_at,discovered_at,application_url,auto_apply_eligible,auto_apply_adapter,application_schema_id,companies(name,logo_url,last_scanned_at)")
      .in("id", ids)
      .eq("is_active", true)
      .eq("auto_apply_eligible", true);
    if (error) throw new Error(error.message);
    jobs.push(...(data ?? []));
  }

  const matched = jobs.map((job) => {
    const match = matchByJob.get(String(job.id));
    return {
      id: job.id, title: job.title, company: job.companies?.name ?? "", logoUrl: job.companies?.logo_url ?? null,
      sourceScannedAt: job.companies?.last_scanned_at ?? null, location: job.location, remoteType: job.remote_type,
      employmentType: job.employment_type, seniority: job.seniority, salaryMin: job.salary_min, salaryMax: job.salary_max,
      salaryCurrency: job.salary_currency, publishedAt: job.published_at, discoveredAt: job.discovered_at,
      applicationUrl: job.application_url, autoApplyEligible: true, adapter: job.auto_apply_adapter,
      applicationSchemaId: job.application_schema_id, matchScore: match ? Number(match.match_score) : null,
      hardRequirementsMet: true, explanation: match?.explanation ?? null,
    };
  }).sort((a,b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

  const readiness = await applicationReadiness(userId, matched.map((job) => ({id:job.id,application_schema_id:job.applicationSchemaId})));
  const ready = matched.map((job) => {
    const missingQuestions = readiness.get(job.id) ?? [];
    const actionable = missingQuestions.filter((q) => !q.answerKey.startsWith("system:"));
    return { ...job, missingQuestions, readyForUser: missingQuestions.length === 0, needsUserAnswers: actionable.length > 0, manualApply: false };
  });
  const inventoryUpdatedAt = ready.map((job) => job.sourceScannedAt).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
  return {
    inventoryUpdatedAt, matchedCount: ready.length, readyCount: ready.filter((j) => j.readyForUser).length,
    manualApplyCount: 0, needsAnswersCount: ready.filter((j) => j.needsUserAnswers).length,
    minimumMatchScore: minimum, jobs: ready,
  };
}

export async function getAutoApplyJob({ data }: { data: { jobId: string } }) {
  const userId = await currentUserId();
  const jobId = data.jobId.trim();
  const [{ data: job }, { data: match }, { data: attempts }, { data: queue }] = await Promise.all([
    supabase.from("jobs").select("id,title,description,location,country,remote_type,employment_type,seniority,salary_min,salary_max,salary_currency,published_at,discovered_at,application_url,auto_apply_eligible,auto_apply_adapter,application_schema_id,companies(name,logo_url,website)").eq("id", jobId).eq("is_active", true).maybeSingle(),
    supabase.from("job_matches").select("match_score,hard_requirements_met,explanation").eq("user_id", userId).eq("job_id", jobId).maybeSingle(),
    supabase.from("application_attempts").select("status,verified_at,queued_at").eq("user_id", userId).eq("job_id", jobId).order("queued_at", { ascending:false }).limit(1),
    supabase.from("application_queue").select("status").eq("user_id", userId).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!job) return null;
  const readiness = job.auto_apply_eligible ? await applicationReadiness(userId,[{id:job.id,application_schema_id:job.application_schema_id}]) : new Map<string,MissingApplicationQuestion[]>();
  const missingQuestions = readiness.get(job.id) ?? [];
  const latestAttempt = attempts?.[0] ?? null;
  return {
    id:job.id,title:job.title,description:job.description ?? "",company:job.companies?.name ?? "",companyWebsite:job.companies?.website ?? null,
    logoUrl:job.companies?.logo_url ?? null,location:job.location,country:job.country,remoteType:job.remote_type,employmentType:job.employment_type,
    seniority:job.seniority,salaryMin:job.salary_min,salaryMax:job.salary_max,salaryCurrency:job.salary_currency,publishedAt:job.published_at,
    discoveredAt:job.discovered_at,applicationUrl:job.application_url,autoApplyEligible:job.auto_apply_eligible,adapter:job.auto_apply_adapter,
    matchScore:match?Number(match.match_score):null,hardRequirementsMet:match?.hard_requirements_met ?? false,explanation:match?.explanation ?? null,
    missingQuestions,readyForUser:job.auto_apply_eligible && missingQuestions.length===0,manualApply:!job.auto_apply_eligible && Boolean(job.application_url),
    applicationStatus:latestAttempt?.status ?? queue?.status ?? null,verifiedAt:latestAttempt?.verified_at ?? null,
  };
}

export async function getAutoApplyOverview() {
  const userId = await currentUserId();
  const [ready, attempts, credits, subscription, consent] = await Promise.all([
    supabase.from("jobs").select("id",{count:"exact",head:true}).eq("auto_apply_eligible",true).eq("is_active",true),
    supabase.from("application_attempts").select("status").eq("user_id",userId),
    supabase.from("application_credits").select("*").eq("user_id",userId).order("period_start",{ascending:false}).limit(1),
    supabase.from("subscriptions").select("plan_code,status,plans(weekly_application_limit,name)").eq("user_id",userId).maybeSingle(),
    supabase.from("auto_apply_consents").select("authorized,revoked_at").eq("user_id",userId).maybeSingle(),
  ]);
  const statuses=attempts.data ?? [];
  return {
    readyCount:ready.count ?? 0,verified:statuses.filter((s)=>s.status==="verified").length,
    processing:statuses.filter((s)=>["preparing","resume_generating","ready","submitting","submitted_unverified"].includes(s.status)).length,
    queued:statuses.filter((s)=>s.status==="queued").length,failed:statuses.filter((s)=>s.status.startsWith("failed")).length,
    weeklyLimit:subscription.data?.plans?.weekly_application_limit ?? null,planName:subscription.data?.plans?.name ?? null,
    subscriptionStatus:subscription.data?.status ?? "inactive",creditsConsumed:credits.data?.[0]?.consumed ?? 0,
    consentGranted:consent.data?.authorized===true && !consent.data?.revoked_at,
  };
}

export async function startAutoApplyBatch({ data }: { data: { jobIds: string[] } }) {
  const { data: result, error } = await supabase.functions.invoke("start-auto-apply-batch", { body: { jobIds: data.jobIds } });
  if (error) throw new Error(error.message);
  return result as {
    status: "queued"|"consent_required"|"subscription_required"|"jobs_unavailable"|"answers_required"|"limit_exceeded";
    batchId: string|null;
    results: Record<string, number>;
  };
}

export async function getBatchProgress({ data }: { data: { batchId: string } }) {
  const userId = await currentUserId();
  const [{ data: batch }, { data: attempts }] = await Promise.all([
    supabase.from("application_batches").select("*").eq("id",data.batchId).eq("user_id",userId).maybeSingle(),
    supabase.from("application_attempts").select("id,status,error_message,submitted_at,verified_at,jobs(title,companies(name))").eq("batch_id",data.batchId).eq("user_id",userId).order("queued_at",{ascending:true}),
  ]);
  return { batch, attempts:(attempts ?? []).map((a)=>({id:a.id,status:a.status,title:a.jobs?.title ?? "",company:a.jobs?.companies?.name ?? "",errorMessage:a.error_message})) };
}

export async function listAvailablePlans() {
  const { data,error }=await supabase.from("plans").select("code,name,weekly_application_limit,price_amount,price_currency,billing_period,sort_order").eq("active",true).order("sort_order");
  if(error) throw new Error(error.message);
  return data ?? [];
}

export async function listMyApplications() {
  const userId=await currentUserId();
  const {data}=await supabase.from("application_attempts").select("id,status,queued_at,submitted_at,verified_at,adapter,submission_reference,jobs(title,location,companies(name))").eq("user_id",userId).order("queued_at",{ascending:false}).limit(200);
  return (data ?? []).map((a)=>({id:a.id,status:a.status,title:a.jobs?.title ?? "",company:a.jobs?.companies?.name ?? "",adapter:a.adapter,submittedAt:a.submitted_at,verifiedAt:a.verified_at,reference:a.submission_reference}));
}
