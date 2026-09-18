import { chromium, type Browser } from "playwright";
import { logger } from "../utils/logger.js";

let browser: Browser | null = null;

/**
 * Plain Chromium. No stealth plugins, no fingerprint spoofing, no CAPTCHA
 * solving, no proxy rotation: if a site blocks automation we report
 * AUTOMATION_BLOCKED and the job leaves the Auto Apply inventory.
 */
export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  logger.info("launching chromium");
  browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = null;
  }
}
