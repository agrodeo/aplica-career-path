import { loadConfig } from "./config.js";
import { claimApplications } from "./queue/claim.js";
import { drainInspections, processApplication } from "./queue/processor.js";
import { closeBrowser } from "./browser/browser.js";
import { logger } from "./utils/logger.js";

let running = true;

async function runCycle() {
  const config = loadConfig();
  const inspected = await drainInspections();
  const items = await claimApplications(config.MAX_CONCURRENCY);
  for (const item of items) {
    if (!running) break;
    await processApplication(item);
  }
  return { inspected, processed: items.length };
}

async function main() {
  const config = loadConfig();
  logger.info(
    { workerId: config.WORKER_ID, mode: config.WORKER_MODE, dryRun: config.DRY_RUN, runOnce: config.RUN_ONCE },
    "worker started",
  );

  if (config.RUN_ONCE) {
    try {
      const result = await runCycle();
      logger.info(result, "worker cycle completed");
    } finally {
      await closeBrowser();
    }
    return;
  }

  while (running) {
    try {
      const result = await runCycle();
      if (!result.processed && !result.inspected) await sleep(config.POLL_INTERVAL_MS);
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
