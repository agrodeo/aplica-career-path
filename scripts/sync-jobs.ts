import { syncAllRegisteredJobSources } from "../src/lib/job-sync.server";

async function main() {
  const result = await syncAllRegisteredJobSources({
    concurrency: 8,
    staleAfterMinutes: 10,
    limit: 100,
    requestedBy: null,
  });

  console.log(JSON.stringify({
    syncedAt: new Date().toISOString(),
    ...result,
  }, null, 2));

  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
