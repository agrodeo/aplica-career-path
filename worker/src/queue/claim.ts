import { loadConfig } from "../config.js";
import { ApplicationError } from "../utils/errors.js";

export interface QueueItem {
  id: string;
  user_id: string;
  job_id: string;
  attempt_id: string;
  batch_id: string | null;
}

export interface InspectionItem {
  id: string;
  url: string;
  mode: "inspect" | "dry_run";
  requested_by: string;
}

function api(path: string) {
  const config = loadConfig();
  return `${config.APLICA_API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const config = loadConfig();
  const response = await fetch(api(path), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.WORKER_SERVICE_TOKEN}` },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new ApplicationError("NETWORK_ERROR", `Aplica API ${path} failed [${response.status}]: ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Atomically claims queued applications; two workers never get the same row. */
export async function claimApplications(limit = 1): Promise<QueueItem[]> {
  const config = loadConfig();
  const result = await post<{ claimed: QueueItem[] }>("/api/public/worker/jobs/claim", { workerId: config.WORKER_ID, limit });
  return result.claimed ?? [];
}

export async function claimInspections(limit = 1): Promise<InspectionItem[]> {
  const config = loadConfig();
  const result = await post<{ claimed: InspectionItem[] }>("/api/public/worker/inspections/claim", { workerId: config.WORKER_ID, limit });
  return result.claimed ?? [];
}

export async function reportStatus(queueId: string, status: string): Promise<void> {
  await post(`/api/public/worker/jobs/${queueId}/status`, { status });
}

export async function reportSubmission(queueId: string, payload: Record<string, unknown>): Promise<void> {
  await post(`/api/public/worker/jobs/${queueId}/submission`, payload);
}

export async function reportFailure(queueId: string, payload: Record<string, unknown>): Promise<void> {
  await post(`/api/public/worker/jobs/${queueId}/failure`, payload);
}

export async function reportInspection(inspectionId: string, payload: Record<string, unknown>): Promise<void> {
  await post(`/api/public/worker/inspections/${inspectionId}/result`, payload);
}
