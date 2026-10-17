import { chromium, type Browser } from "playwright";
import { logger } from "../utils/logger.js";

let browser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;

/**
 * Plain Chromium. No stealth plugins, no fingerprint spoofing, no CAPTCHA
 * solving, no proxy rotation: if a site blocks automation we report
 * AUTOMATION_BLOCKED and the job leaves the Auto Apply inventory.
 */
export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (browserPromise) return browserPromise;

  logger.info("launching chromium");
  browserPromise = chromium
    .launch({ headless: true, args: ["--disable-dev-shm-usage"] })
    .then((launched) => {
      browser = launched;
      return launched;
    })
    .finally(() => {
      browserPromise = null;
    });

  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  const pending = browserPromise;
  const active = browser ?? (pending ? await pending.catch(() => null) : null);

  browser = null;
  browserPromise = null;

  if (active) {
    await active.close().catch(() => undefined);
  }
}
