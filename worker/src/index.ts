import { loadConfig } from "./config.js";
import { claimApplications } from "./queue/claim.js";
import { drainInspections, processApplication } from "./queue/processor.js";
import { closeBrowser } from "./browser/browser.js";
import { logger } from "./utils/logger.js";

let running = true;

async function main() {
  const config = loadConfig();
  logger.info({ workerId: config.WORKER_ID, mode: config.WORKER_MODE, dryRun: config.DRY_RUN }, "worker started");

  while (running) {
    try {
      const inspected = await drainInspections();
      const items = running
        ? await claimApplications(config.MAX_CONCURRENCY)
        : [];
      if (items.length) {
        // Claimed rows already hold locks. Process them concurrently so a later
        // item never sits idle long enough for its lock to be considered stale.
        await Promise.all(items.map((item) => processApplication(item)));
      }
      if (!items.length && !inspected) await sleep(config.POLL_INTERVAL_MS);
    } catch (error) {
      logger.error({ err: error instanceof Error ? error.message : String(error) }, "loop error");
      await sleep(config.POLL_INTERVAL_MS);
    }
  }

  await closeBrowser();
  logger.info("worker stopped");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "shutting down after the current application");
    running = false;
  });
}

main().catch((error) => {
  logger.error({ err: error instanceof Error ? error.message : String(error) }, "worker crashed");
  process.exitCode = 1;
});
