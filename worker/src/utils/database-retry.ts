import { logger } from "./logger.js";

type Result = { error: { message: string; code?: string } | null; status?: number };

/** Only use for reads or RPCs whose database operation is explicitly idempotent. */
export async function recoverableDatabaseCall<T extends Result>(
  operation: () => PromiseLike<T>,
  name: string,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  for (let attempt = 1; ; attempt++) {
    try {
      const result = await operation();
      const code = result.error?.code ?? "";
      const retryable = (result.status ?? 0) >= 500 || /^(PGRST00[0-3]|08\w{3}|57014)$/.test(code) ||
        /fetch failed|timeout|ECONNRESET|ETIMEDOUT|aborted/i.test(result.error?.message ?? "");
      if (!result.error || !retryable || attempt >= attempts) return result;
      logger.warn({ operation: name, attempt, code, status: result.status }, "retrying recoverable database call");
    } catch (error) {
      if (attempt >= attempts || !/fetch|network|timeout|ECONNRESET|ETIMEDOUT|abort/i.test(String(error))) throw error;
      logger.warn({ operation: name, attempt }, "retrying interrupted database call");
    }
    await new Promise((resolve) => setTimeout(resolve, (options.delayMs ?? 1000) * attempt));
  }
}
