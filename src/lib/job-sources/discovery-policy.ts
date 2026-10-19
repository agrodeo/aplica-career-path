// Geography is a scheduling preference, never proof of work authorization.
export const LATAM_COUNTRIES = new Set([
  "ar", "bo", "br", "cl", "co", "cr", "cu", "do", "ec", "sv", "gt",
  "ht", "hn", "mx", "ni", "pa", "py", "pe", "pr", "uy", "ve",
]);

export function isLatamJob(country: string | null, location: string | null) {
  return LATAM_COUNTRIES.has((country ?? "").toLowerCase()) ||
    /\blatam\b|latin america|south america|américa latina|america latina/i.test(location ?? "");
}

export type InspectionCandidate = {
  external_job_id: string;
  application_url: string | null;
  last_verified_at: string | null;
  country?: string | null;
  location?: string | null;
  remote_type?: string | null;
  published_at?: string | null;
};

export function inspectionPriority(job: InspectionCandidate, now = Date.now()) {
  const geography = isLatamJob(job.country ?? null, job.location ?? null) ? 1000
    : !job.country && job.remote_type === "remote" &&
        /\b(worldwide|anywhere|global)\b/i.test(job.location ?? "") ? 600 : 0;
  const published = Date.parse(job.published_at ?? "");
  const age = (now - published) / 86_400_000;
  // Missing dates and newly discovered jobs must never masquerade as recent.
  const freshness = !Number.isFinite(age) || age < 0 ? 50
    : age <= 7 ? 300 : age <= 30 ? 200 : age <= 90 ? 100 : 0;
  return geography + freshness;
}

export function selectInspectionCandidates<T extends InspectionCandidate>(
  jobs: T[], currentIds: Set<string>, now = Date.now(), limit = 200,
) {
  return jobs.filter(job => {
    if (!currentIds.has(job.external_job_id) || !job.application_url) return false;
    const verified = Date.parse(job.last_verified_at ?? "");
    return !Number.isFinite(verified) || now - verified >= 7 * 86_400_000;
  }).sort((a, b) =>
    inspectionPriority(b, now) - inspectionPriority(a, now) ||
    (Date.parse(b.published_at ?? "") || 0) - (Date.parse(a.published_at ?? "") || 0) ||
    Number(Boolean(a.last_verified_at)) - Number(Boolean(b.last_verified_at)) ||
    a.external_job_id.localeCompare(b.external_job_id),
  ).slice(0, limit);
}
