import { loadConfig } from "./config.js";
import { ApplicationError } from "./utils/errors.js";
import type { MasterProfile } from "./adapters/types.js";

export interface ClaimedApplication {
  application_attempt_id: string;
  queue_id: string;
  attempt_number: number;
  batch_id: string | null;
  job: {
    id: string;
    title: string;
    description: string;
    location: string | null;
    country: string | null;
    application_url: string;
    ats_type: string | null;
    adapter: string | null;
    submission_mechanism: string | null;
    auto_apply_eligible: boolean;
    is_active: boolean;
  };
  company: { id?: string; name?: string } | null;
  master_profile: Omit<MasterProfile, "verifiedApplicationAnswers">;
  verified_answers: MasterProfile["verifiedApplicationAnswers"];
  preferences: Record<string, unknown> | null;
  consent: { authorized?: boolean; revoked_at?: string | null } | null;
  subscription: { plan_code: string | null; status: string | null; credits_available: number };
}

export interface InspectionItem {
  id: string;
  url: string;
  mode: "inspect" | "dry_run";
  requested_by: string;
}

interface UploadGrant {
  upload_url: string;
  token: string;
  storage_path: string;
  bucket: string;
  content_type: string;
  expires_in: number;
}

function apiUrl(path: string) {
  const config = loadConfig();
  return `${config.APLICA_API_BASE_URL.replace(/\/$/, "")}${path}`;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const config = loadConfig();
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.AUTO_APPLY_WORKER_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new ApplicationError("NETWORK_ERROR", `Aplica API ${path} failed [${response.status}]: ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function claimApplication(): Promise<ClaimedApplication | null> {
  const config = loadConfig();
  const result = await postJson<{ claimed: ClaimedApplication | null }>("/api/public/worker/claim-application", {
    worker_id: config.WORKER_ID,
  });
  return result.claimed ?? null;
}

export async function claimApplications(limit = 1): Promise<ClaimedApplication[]> {
  const claimed: ClaimedApplication[] = [];
  for (let i = 0; i < Math.max(1, limit); i += 1) {
    const item = await claimApplication();
    if (!item) break;
    claimed.push(item);
  }
  return claimed;
}

export async function claimInspections(limit = 1): Promise<InspectionItem[]> {
  const config = loadConfig();
  const result = await postJson<{ claimed: InspectionItem[] }>("/api/public/worker/inspections/claim", {
    workerId: config.WORKER_ID,
    limit,
  });
  return result.claimed ?? [];
}

export async function reportStatus(queueId: string, status: string): Promise<void> {
  const config = loadConfig();
  await postJson(`/api/public/worker/jobs/${queueId}/status`, {
    status,
    worker_id: config.WORKER_ID,
  });
}

export async function reportSubmission(queueId: string, payload: Record<string, unknown>): Promise<void> {
  const config = loadConfig();
  await postJson(`/api/public/worker/jobs/${queueId}/submission`, {
    ...payload,
    worker_id: config.WORKER_ID,
  });
}

export async function reportFailure(queueId: string, payload: Record<string, unknown>): Promise<void> {
  const config = loadConfig();
  await postJson(`/api/public/worker/jobs/${queueId}/failure`, {
    ...payload,
    worker_id: config.WORKER_ID,
  });
}

export async function reportInspection(inspectionId: string, payload: Record<string, unknown>): Promise<void> {
  await postJson(`/api/public/worker/inspections/${inspectionId}/result`, payload);
}

export async function heartbeat(applicationAttemptId: string): Promise<void> {
  const config = loadConfig();
  await postJson("/api/public/worker/heartbeat", {
    application_attempt_id: applicationAttemptId,
    worker_id: config.WORKER_ID,
  });
}

export async function createUpload(applicationAttemptId: string, type: "resume" | "evidence", contentType: "application/pdf" | "image/png"): Promise<UploadGrant> {
  const config = loadConfig();
  return postJson<UploadGrant>("/api/public/worker/create-upload", {
    application_attempt_id: applicationAttemptId,
    type,
    content_type: contentType,
    worker_id: config.WORKER_ID,
  });
}

export async function uploadToGrant(grant: UploadGrant, bytes: Buffer): Promise<string> {
  const uploadBody = new Blob([Uint8Array.from(bytes)], {
    type: grant.content_type,
  });
  const response = await fetch(grant.upload_url, {
    method: "PUT",
    headers: {
      "content-type": grant.content_type,
      "cache-control": "max-age=3600",
      "x-upsert": "true",
    },
    body: uploadBody,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApplicationError("FILE_UPLOAD_FAILED", `Signed upload failed [${response.status}]: ${text.slice(0, 300)}`);
  }
  return grant.storage_path;
}

export async function saveResumeVariant(payload: Record<string, unknown>): Promise<{ id: string }> {
  const config = loadConfig();
  return postJson<{ id: string }>("/api/public/worker/resume-variant", {
    ...payload,
    worker_id: config.WORKER_ID,
  });
}
