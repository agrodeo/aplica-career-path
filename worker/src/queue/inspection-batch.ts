/** Stop scheduling after persistence fails, but let all in-flight work settle
 * before the caller closes the shared browser or saves its checkpoint cache. */
export async function runInspectionBatch<T>(items: T[], concurrency: number, process: (item: T) => Promise<void>): Promise<number> {
  let cursor = 0;
  let completed = 0;
  let failed = false;
  let firstError: unknown;
  async function runner() {
    while (!failed) {
      const item = items[cursor++];
      if (item === undefined) return;
      try {
        await process(item);
        completed++;
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
  if (failed) throw firstError;
  return completed;
}
