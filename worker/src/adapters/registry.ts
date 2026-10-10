import { ashbyPublicAdapter } from "./ashby-public.js";
import { greenhousePublicAdapter } from "./greenhouse-public.js";
import { leverPublicAdapter } from "./lever-public.js";
import { smartRecruitersPublicAdapter } from "./smartrecruiters-public.js";
import { unsupportedAdapter } from "./unsupported.js";
import { workablePublicAdapter } from "./workable-public.js";
import { workdayPublicAdapter } from "./workday-public.js";
import type { ApplicationAdapter } from "./types.js";

/**
 * Public application adapters. Every job still has to pass runtime inspection:
 * CAPTCHA, login requirements, unknown required fields, missing CV upload, or
 * an unverifiable confirmation keep it out of Auto Apply.
 */
export const enabledAdapters: ApplicationAdapter[] = [
  greenhousePublicAdapter,
  leverPublicAdapter,
  ashbyPublicAdapter,
  workablePublicAdapter,
  smartRecruitersPublicAdapter,
  workdayPublicAdapter,
];

export function resolveAdapter(url: string): ApplicationAdapter {
  return enabledAdapters.find((adapter) => adapter.supports(url)) ?? unsupportedAdapter;
}

export function adapterById(id: string): ApplicationAdapter {
  return enabledAdapters.find((adapter) => adapter.id === id) ?? unsupportedAdapter;
}
