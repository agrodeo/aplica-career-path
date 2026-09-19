import { z } from "zod";

const schema = z.object({
  APLICA_API_BASE_URL: z.string().url(),
  WORKER_SERVICE_TOKEN: z.string().min(20),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WORKER_ID: z.string().default(`worker-${Math.random().toString(36).slice(2, 8)}`),
  WORKER_MODE: z.enum(["development", "production"]).default("development"),
  DRY_RUN: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_CONCURRENCY: z.coerce.number().min(1).max(4).default(1),
  LOG_LEVEL: z.string().default("info"),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(): WorkerConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid worker configuration:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const config = parsed.data;

  // Production must never fake a submission, and must never silently dry-run.
  if (config.WORKER_MODE === "production" && config.DRY_RUN) {
    throw new Error("DRY_RUN must be false in production mode: a dry run never produces a verified application.");
  }
  return config;
}

export const RESUME_BUCKET = "resumes";
export const EVIDENCE_BUCKET = "application-evidence";
