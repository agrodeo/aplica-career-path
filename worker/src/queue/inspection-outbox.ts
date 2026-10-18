import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { logger } from "../utils/logger.js";

const recordSchema = z.object({
  version: z.literal(1),
  inspectionId: z.string().uuid(),
  workerId: z.string().min(1),
  createdAt: z.string().datetime(),
  payload: z.object({ status: z.enum(["completed", "failed"]) }).passthrough(),
});
export type InspectionReport = z.infer<typeof recordSchema>;
type Sender = (id: string, payload: Record<string, unknown>, workerId: string) => Promise<void>;

export class InspectionLeaseLostError extends Error {}

/** Public form inspection data only. Never store profiles, CVs or credentials. */
export function createInspectionOutbox(directory: string, workerId: string, send: Sender) {
  async function initialize() {
    await mkdir(directory, { recursive: true });
    // Keep the directory cacheable even after every pending report is acknowledged.
    await writeFile(join(directory, ".keep"), "");
  }

  async function deliver(record: InspectionReport, path: string) {
    if (Date.now() - Date.parse(record.createdAt) > 24 * 60 * 60 * 1000) {
      logger.warn({ inspectionId: record.inspectionId }, "discarding expired inspection checkpoint; lease recovery will reinspect");
    } else {
      try {
        await send(record.inspectionId, record.payload, record.workerId);
      } catch (error) {
        if (!(error instanceof InspectionLeaseLostError)) throw error;
        logger.warn({ inspectionId: record.inspectionId }, "discarding checkpoint owned by a newer inspection lease");
      }
    }
    // A lost response leaves this file intact. The atomic RPC is idempotent.
    await unlink(path);
  }

  return {
    async report(inspectionId: string, payload: Record<string, unknown>) {
      const record = recordSchema.parse({ version: 1, inspectionId, workerId, createdAt: new Date().toISOString(), payload });
      await initialize();
      const path = join(directory, `${record.inspectionId}.json`);
      const temporary = `${path}.tmp`;
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600 });
      await rename(temporary, path);
      await deliver(record, path);
    },
    async replay() {
      await initialize();
      let replayed = 0;
      for (const file of (await readdir(directory)).filter(name => name.endsWith(".json")).sort()) {
        const path = join(directory, file);
        const record = recordSchema.parse(JSON.parse(await readFile(path, "utf8")));
        await deliver(record, path);
        replayed++;
      }
      return replayed;
    },
  };
}
