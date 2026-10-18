import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  WORKER_ID: z.string().default(`worker-${Math.random().toString(36).slice(2, 8)}`),
  WORKER_MODE: z.enum(["development", "production"]).default("development"),
  DRY_RUN: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  RUN_ONCE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_CONCURRENCY: z.coerce.number().min(1).max(4).default(1),
  RUN_TARGET: z.enum(["all", "applications", "inspections"]).default("all"),
  INSPECTION_PROVIDER: z.enum(["all", "greenhouse", "ashby", "workable", "smartrecruiters", "workday", "lever"]).default("all"),
  INSPECTION_BATCH_SIZE: z.coerce.number().int().min(1).max(120).default(20),
  INSPECTION_MAX_BATCHES: z.coerce.number().int().min(1).max(20).default(1),
  INSPECTION_RUN_BUDGET_MS: z.coerce.number().int().min(1000).max(3600000).default(720000),
  INSPECTION_OUTBOX_DIR: z.string().min(1).default(".inspection-outbox"),
  INSPECTION_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(4),
  SUPABASE_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  LOG_LEVEL: z.string().default("info"),
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(): WorkerConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid worker configuration:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const config = parsed.data;

  if (config.WORKER_MODE === "production" && config.DRY_RUN) {
    throw new Error("DRY_RUN must be false in production mode: a dry run never produces a verified application.");
  }
  return config;
}

export const RESUME_BUCKET = "resumes";
export const EVIDENCE_BUCKET = "application-evidence";
