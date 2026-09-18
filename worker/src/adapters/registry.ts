import { greenhousePublicAdapter } from "./greenhouse-public.js";
import { unsupportedAdapter } from "./unsupported.js";
import type { ApplicationAdapter } from "./types.js";

/**
 * Enabled adapters, in priority order. Only ONE public-form family is enabled
 * for this milestone; Lever stays out of the registry until Greenhouse is proven
 * end to end. Anything unmatched falls through to the unsupported adapter.
 */
export const enabledAdapters: ApplicationAdapter[] = [greenhousePublicAdapter];

export function resolveAdapter(url: string): ApplicationAdapter {
  return enabledAdapters.find((adapter) => adapter.supports(url)) ?? unsupportedAdapter;
}

export function adapterById(id: string): ApplicationAdapter {
  return enabledAdapters.find((adapter) => adapter.id === id) ?? unsupportedAdapter;
}
