export type JobRequirements = {
  minimumYearsExperience: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredLanguages: string[];
  degreeRequired: boolean;
  workAuthorizationCountry: string | null;
  sponsorshipUnavailable: boolean;
  requiredSentences: string[];
};

export type MatchCandidate = {
  currentTitle: string;
  city: string;
  country: string;
  targetRoles: string[];
  targetLocations: string[];
  remoteAllowed: boolean;
  hybridAllowed: boolean;
  onsiteAllowed: boolean;
  employmentTypes: string[];
  seniorityLevels: string[];
  willingToRelocate: boolean;
  internationalRemote: boolean;
  minimumSalary: number | null;
  salaryCurrency: string | null;
  skills: Array<{ name: string; yearsExperience: number | null }>;
  languages: Array<{ language: string; level: string }>;
  education: Array<{ degree: string; field: string }>;
  experiences: Array<{
    title: string;
    company: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    description: string;
    achievements: string[];
  }>;
  tools: string[];
  preferredTasks: string[];
  avoidTasks: string[];
  workAuthorizationAnswers: Array<{
    key: string;
    booleanValue: boolean | null;
    textValue: string | null;
  }>;
};

export type MatchableJob = {
  title: string;
  description: string;
  location: string | null;
  country: string | null;
  remoteType: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
};

const KNOWN_SKILLS = [
  "javascript","typescript","react","next.js","node.js","node","python","django","flask","java","kotlin","swift","objective-c",
  "c#",".net","c++","go","golang","rust","ruby","rails","php","laravel","sql","postgresql","mysql","mongodb","redis",
  "snowflake","bigquery","databricks","spark","kafka","airflow","dbt","aws","azure","gcp","docker","kubernetes","terraform",
  "graphql","rest","api","git","github","figma","excel","google sheets","tableau","power bi","looker","salesforce","hubspot",
  "marketo","meta ads","facebook ads","google ads","seo","sem","crm","b2b","b2c","saas","enterprise sales","cold email",
  "product management","project management","agile","scrum","jira","notion","financial analysis","financial modeling",
  "accounting","gaap","ifrs","machine learning","deep learning","pytorch","tensorflow","llm","nlp","computer vision",
  "data analysis","data analytics","statistics","a/b testing","experimentation","growth","growth marketing","performance marketing",
  "content marketing","copywriting","social media","community management","customer success","account management","business development",
  "recruiting","talent acquisition","operations","strategy","consulting","supply chain","logistics","procurement"
];

const LANGUAGE_NAMES = [
  "english","spanish","portuguese","french","german","italian","dutch","japanese","korean","mandarin","chinese","arabic","hindi",
  "inglés","ingles","español","espanol","portugués","portugues","francés","frances","alemán","aleman","italiano"
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceSplit(value: string) {
  return value
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 15);
}

function overlapScore(a: string, b: string) {
  const left = new Set(normalize(a).split(" ").filter((x) => x.length > 2));
  const right = new Set(normalize(b).split(" ").filter((x) => x.length > 2));
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((word) => right.has(word)).length;
  const denom = Math.min(left.size, right.size);
  return Math.round((common / Math.max(1, denom)) * 100);
}

function containsPhrase(text: string, phrase: string) {
  const t = normalize(text);
  const p = normalize(phrase);
  if (!p) return false;
  return t.includes(p);
}

function skillMentions(sentence: string) {
  return KNOWN_SKILLS.filter((skill) => containsPhrase(sentence, skill));
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function extractJobRequirements(job: MatchableJob): JobRequirements {
  const sentences = sentenceSplit(job.description);
  const requiredSentences = sentences.filter((sentence) =>
    /\b(required|requirements?|must have|must be|need to|needs to|minimum|at least|\d+\+?\s+years?|requerid[oa]s?|requisitos?|debe(?:s|ra)?|mínimo|minimo)\b/i.test(sentence),
  );
  const preferredSentences = sentences.filter((sentence) =>
    /\b(preferred|nice to have|bonus|plus|ideally|desirable|deseable|preferid[oa])\b/i.test(sentence),
  );

  let minimumYearsExperience: number | null = null;
  for (const sentence of requiredSentences) {
    const matches = [...sentence.matchAll(/(?:minimum\s+of\s+|at\s+least\s+)?(\d{1,2})\s*\+?\s*(?:years?|anos|años)\s+(?:of\s+)?(?:professional\s+)?experience/gi)];
    for (const match of matches) {
      const years = Number(match[1]);
      if (Number.isFinite(years)) minimumYearsExperience = Math.max(minimumYearsExperience ?? 0, years);
    }
  }

  const requiredSkills = dedupe(requiredSentences.flatMap(skillMentions));
  const preferredSkills = dedupe(preferredSentences.flatMap(skillMentions)).filter((skill) => !requiredSkills.includes(skill));

  const requiredLanguages = dedupe(
    requiredSentences.flatMap((sentence) =>
      LANGUAGE_NAMES.filter((language) => containsPhrase(sentence, language)).map(canonicalLanguage),
    ),
  );

  const degreeRequired = requiredSentences.some(
    (sentence) =>
      /\b(bachelor'?s?|master'?s?|degree|licenciatura|titulo universitario|título universitario|universit(?:y|ario))\b/i.test(
        sentence,
      ) &&
      !/or equivalent(?: practical)? experience|equivalent experience|experiencia equivalente/i.test(
        sentence,
      ),
  );

  let workAuthorizationCountry: string | null = null;
  const authText = requiredSentences.find((sentence) =>
    /authorized to work|authorization to work|right to work|legally (?:authorized|eligible) to work|permiso para trabajar|autorizacion.*trabajar|autorización.*trabajar/i.test(sentence),
  );
  if (authText) {
    const known = [
      ["united states", "US"], ["u.s.", "US"], ["usa", "US"], ["canada", "CA"], ["united kingdom", "GB"], ["uk", "GB"],
      ["argentina", "AR"], ["brazil", "BR"], ["brasil", "BR"], ["mexico", "MX"], ["méxico", "MX"], ["spain", "ES"], ["españa", "ES"],
    ] as const;
    workAuthorizationCountry = known.find(([name]) => containsPhrase(authText, name))?.[1] ?? null;
  }

  const sponsorshipUnavailable = sentences.some((sentence) =>
    /(?:do not|does not|cannot|can't|unable to|no)\s+(?:offer|provide|support)?\s*(?:visa\s+)?sponsorship|no sponsorship available|without sponsorship/i.test(sentence),
  );

  return {
    minimumYearsExperience,
    requiredSkills,
    preferredSkills,
    requiredLanguages,
    degreeRequired,
    workAuthorizationCountry,
    sponsorshipUnavailable,
    requiredSentences: requiredSentences.slice(0, 12),
  };
}

function canonicalLanguage(value: string) {
  const v = normalize(value);
  if (["english","ingles"].includes(v)) return "english";
  if (["spanish","espanol"].includes(v)) return "spanish";
  if (["portuguese","portugues"].includes(v)) return "portuguese";
  if (["french","frances"].includes(v)) return "french";
  if (["german","aleman"].includes(v)) return "german";
  if (["italian","italiano"].includes(v)) return "italian";
  if (["chinese","mandarin"].includes(v)) return "chinese";
  return v;
}

function experienceYears(experiences: MatchCandidate["experiences"]) {
  const intervals = experiences
    .map((experience) => {
      if (!experience.startDate) return null;
      const start = new Date(experience.startDate).getTime();
      const end =
        experience.isCurrent || !experience.endDate
          ? Date.now()
          : new Date(experience.endDate).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return null;
      }
      return { start, end };
    })
    .filter(
      (interval): interval is { start: number; end: number } =>
        interval !== null,
    )
    .sort((a, b) => a.start - b.start);

  if (!intervals.length) return 0;

  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  const milliseconds = merged.reduce(
    (total, interval) => total + (interval.end - interval.start),
    0,
  );
  return milliseconds / (1000 * 60 * 60 * 24 * 365.25);
}

function modeOf(value: string | null) {
  const v = normalize(value);
  if (v.includes("remote") || v.includes("remoto")) return "remote";
  if (v.includes("hybrid") || v.includes("hibrid")) return "hybrid";
  if (v.includes("onsite") || v.includes("on site") || v.includes("presencial")) return "onsite";
  return "unknown";
}

function answerForAuthorization(candidate: MatchCandidate, country: string) {
  const aliases: Record<string, string[]> = {
    US: ["us","usa","united_states","united states"],
    CA: ["ca","canada"],
    GB: ["gb","uk","united_kingdom","united kingdom"],
    AR: ["ar","argentina"],
    BR: ["br","brazil","brasil"],
    MX: ["mx","mexico"],
    ES: ["es","spain","espana"],
  };
  const needles = aliases[country] ?? [country.toLowerCase()];
  return candidate.workAuthorizationAnswers.find((answer) => {
    const key = normalize(answer.key);
    return /work.*author|author.*work|right.*work|legal.*work/.test(key) && needles.some((needle) => key.includes(normalize(needle)));
  }) ?? null;
}

function sponsorshipAnswer(candidate: MatchCandidate) {
  return candidate.workAuthorizationAnswers.find((answer) =>
    /sponsor|sponsorship|visa/.test(normalize(answer.key)),
  ) ?? null;
}

export function scoreStructuredMatch(job: MatchableJob, candidate: MatchCandidate) {
  const requirements = extractJobRequirements(job);
  const hardRejects: string[] = [];
  const concerns: string[] = [];
  const positives: string[] = [];

  const mode = modeOf(job.remoteType);
  if (mode === "remote" && !candidate.remoteAllowed) hardRejects.push("remote_not_allowed");
  if (mode === "hybrid" && !candidate.hybridAllowed) hardRejects.push("hybrid_not_allowed");
  if (mode === "onsite" && !candidate.onsiteAllowed) hardRejects.push("onsite_not_allowed");

  if (candidate.employmentTypes.length && job.employmentType) {
    if (!candidate.employmentTypes.some((type) => containsPhrase(job.employmentType!, type) || containsPhrase(type, job.employmentType!))) {
      hardRejects.push("employment_type");
    }
  }

  if (candidate.seniorityLevels.length && job.seniority) {
    if (!candidate.seniorityLevels.some((level) => containsPhrase(job.seniority!, level) || containsPhrase(level, job.seniority!))) {
      concerns.push("El seniority no coincide exactamente con los niveles elegidos.");
    }
  }

  if (candidate.minimumSalary && job.salaryMax && (!candidate.salaryCurrency || !job.salaryCurrency || normalize(candidate.salaryCurrency) === normalize(job.salaryCurrency))) {
    if (job.salaryMax < candidate.minimumSalary) hardRejects.push("salary_below_minimum");
  }

  if (mode !== "remote" && candidate.targetLocations.length && job.location) {
    const locationMatch = candidate.targetLocations.some((location) =>
      containsPhrase(job.location!, location) || containsPhrase(job.country, location),
    );
    if (!locationMatch && !candidate.willingToRelocate) hardRejects.push("location");
  }

  const totalYears = experienceYears(candidate.experiences);
  if (requirements.minimumYearsExperience != null) {
    if (totalYears + 0.25 < requirements.minimumYearsExperience) {
      hardRejects.push("minimum_years_experience");
      concerns.push(`Pide al menos ${requirements.minimumYearsExperience} años; tu perfil confirma aproximadamente ${totalYears.toFixed(1)}.`);
    } else {
      positives.push(`Cumplís el mínimo de ${requirements.minimumYearsExperience} años de experiencia.`);
    }
  }

  if (requirements.degreeRequired && candidate.education.length === 0) {
    hardRejects.push("degree_required");
    concerns.push("La descripción marca un título universitario como requisito.");
  }

  for (const language of requirements.requiredLanguages) {
    const hasLanguage = candidate.languages.some((item) => canonicalLanguage(item.language) === language);
    if (!hasLanguage) {
      hardRejects.push(`language_${language}`);
      concerns.push(`El puesto requiere ${language} y no aparece confirmado en tu perfil.`);
    } else {
      positives.push(`Idioma requerido confirmado: ${language}.`);
    }
  }

  if (requirements.workAuthorizationCountry) {
    const answer = answerForAuthorization(candidate, requirements.workAuthorizationCountry);
    if (answer?.booleanValue === false) hardRejects.push("work_authorization");
    else if (!answer) concerns.push("El puesto menciona autorización laboral y tu respuesta no está confirmada para ese país.");
    else if (answer.booleanValue === true) positives.push("Autorización laboral requerida confirmada.");
  }

  if (requirements.sponsorshipUnavailable) {
    const sponsorship = sponsorshipAnswer(candidate);
    if (sponsorship?.booleanValue === true) hardRejects.push("sponsorship_unavailable");
    else if (!sponsorship) concerns.push("La empresa indica que no ofrece sponsorship; falta confirmar si lo necesitás.");
  }

  const roleCandidates = dedupe([...candidate.targetRoles, candidate.currentTitle, ...candidate.experiences.map((exp) => exp.title)]);
  const roleScore = roleCandidates.length
    ? Math.max(...roleCandidates.map((role) => Math.max(overlapScore(role, job.title), containsPhrase(role, job.title) || containsPhrase(job.title, role) ? 95 : 0)))
    : 45;

  const candidateText = [
    ...candidate.skills.map((skill) => skill.name),
    ...candidate.tools,
    ...candidate.experiences.flatMap((exp) => [exp.title, exp.description, ...exp.achievements]),
  ].join(" ");
  const explicitCandidateSkills = dedupe([...candidate.skills.map((skill) => skill.name), ...candidate.tools]);
  const skillPresent = (skill: string) =>
    explicitCandidateSkills.some((candidateSkill) => containsPhrase(candidateSkill, skill) || containsPhrase(skill, candidateSkill)) ||
    containsPhrase(candidateText, skill);

  const matchedRequiredSkills = requirements.requiredSkills.filter(skillPresent);
  const missingRequiredSkills = requirements.requiredSkills.filter((skill) => !skillPresent(skill));
  const matchedPreferredSkills = requirements.preferredSkills.filter(skillPresent);

  if (missingRequiredSkills.length) concerns.push(`No encontramos evidencia de: ${missingRequiredSkills.slice(0, 4).join(", ")}.`);
  if (matchedRequiredSkills.length) positives.push(`Skills requeridas confirmadas: ${matchedRequiredSkills.slice(0, 4).join(", ")}.`);

  const skillScore = requirements.requiredSkills.length
    ? Math.round((matchedRequiredSkills.length / requirements.requiredSkills.length) * 100)
    : explicitCandidateSkills.length
      ? Math.min(100, Math.round((explicitCandidateSkills.filter((skill) => containsPhrase(job.description, skill)).length / Math.min(explicitCandidateSkills.length, 8)) * 100))
      : 50;

  const relevantExperienceScore = candidate.experiences.length
    ? Math.max(...candidate.experiences.map((exp) => {
        const titleFit = overlapScore(exp.title, job.title);
        const bodyFit = overlapScore(`${exp.title} ${exp.description} ${exp.achievements.join(" ")}`, job.description.slice(0, 5000));
        return Math.round(titleFit * 0.7 + bodyFit * 0.3);
      }))
    : 30;

  const preferredTaskMatches = candidate.preferredTasks.filter((task) => containsPhrase(job.description, task));
  const avoidTaskMatches = candidate.avoidTasks.filter((task) => containsPhrase(job.description, task));
  const contextScore = candidate.preferredTasks.length
    ? Math.max(0, Math.min(100, Math.round((preferredTaskMatches.length / Math.min(candidate.preferredTasks.length, 8)) * 100) - avoidTaskMatches.length * 20))
    : 70;

  let locationScore = 70;
  if (mode === "remote" && candidate.remoteAllowed) locationScore = 100;
  else if (candidate.targetLocations.length) {
    locationScore = candidate.targetLocations.some((location) => containsPhrase(job.location, location) || containsPhrase(job.country, location)) ? 100 : 35;
  }

  const seniorityScore = !candidate.seniorityLevels.length || !job.seniority
    ? 70
    : candidate.seniorityLevels.some((level) => containsPhrase(job.seniority, level) || containsPhrase(level, job.seniority)) ? 100 : 45;

  const employmentScore = !candidate.employmentTypes.length || !job.employmentType
    ? 80
    : candidate.employmentTypes.some((type) => containsPhrase(job.employmentType, type) || containsPhrase(type, job.employmentType)) ? 100 : 30;

  const requirementCoverage = requirements.requiredSkills.length
    ? Math.round((matchedRequiredSkills.length / requirements.requiredSkills.length) * 100)
    : requirements.requiredSentences.length ? 75 : 65;

  let matchScore = Math.round(
    roleScore * 0.30 +
    skillScore * 0.23 +
    relevantExperienceScore * 0.18 +
    requirementCoverage * 0.12 +
    locationScore * 0.07 +
    seniorityScore * 0.04 +
    employmentScore * 0.03 +
    contextScore * 0.03
  );

  if (missingRequiredSkills.length) matchScore -= Math.min(24, missingRequiredSkills.length * 8);
  if (hardRejects.length) matchScore = Math.min(matchScore, 59);
  matchScore = Math.max(0, Math.min(100, matchScore));

  return {
    matchScore,
    hardRequirementsMet: hardRejects.length === 0,
    roleScore,
    skillsScore: skillScore,
    experienceScore: relevantExperienceScore,
    locationScore,
    seniorityScore,
    preferencesScore: Math.round((employmentScore + contextScore) / 2),
    requirements,
    explanation: {
      positives,
      concerns,
      hardRejects,
      matchedSkills: dedupe([...matchedRequiredSkills, ...matchedPreferredSkills]),
      missingRequiredSkills,
      preferredTaskMatches,
      avoidTaskMatches,
      minimumYearsExperience: requirements.minimumYearsExperience,
      totalConfirmedYearsExperience: Number(totalYears.toFixed(1)),
      note: "El match compara evidencia confirmada del perfil contra requisitos y contexto de la vacante; no estima probabilidad de contratación.",
    },
  };
}
