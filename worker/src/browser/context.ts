import type { BrowserContext, Page } from "playwright";
import { getBrowser } from "./browser.js";

/** One isolated browser context per application. Nothing is shared between runs. */
export async function withIsolatedPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 1400 },
    locale: "es-AR",
    acceptDownloads: false,
  });
  context.setDefaultTimeout(30000);
  const page = await context.newPage();
  try {
    return await run(page);
  } finally {
    await context.close().catch(() => undefined);
  }
}
