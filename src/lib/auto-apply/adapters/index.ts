import type { AutoApplyAdapter } from "../types";
import { BaseAdapter } from "./base";

/**
 * Greenhouse: public job board discovery is documented. Submission through the
 * Harvest/Job Board POST API requires employer-authorized credentials, so
 * submission stays false until a real authorized integration exists.
 */
class GreenhouseAdapter extends BaseAdapter {
  readonly name = "greenhouse";
  readonly capabilities = {
    discovery: true,
    schemaDiscovery: true,
    submission: false,
    verification: false,
    publicDiscoverySupported: true,
    authorizedSubmissionSupported: true,
    publicFormSubmissionSupported: false,
  };
}

class LeverAdapter extends BaseAdapter {
  readonly name = "lever";
  readonly capabilities = {
    discovery: true,
    schemaDiscovery: true,
    submission: false,
    verification: false,
    publicDiscoverySupported: true,
    authorizedSubmissionSupported: true,
    publicFormSubmissionSupported: false,
  };
}

class AshbyAdapter extends BaseAdapter {
  readonly name = "ashby";
  readonly capabilities = {
    discovery: true,
    schemaDiscovery: true,
    submission: false,
    verification: false,
    publicDiscoverySupported: true,
    authorizedSubmissionSupported: true,
    publicFormSubmissionSupported: false,
  };
}

class WorkableAdapter extends BaseAdapter {
  readonly name = "workable";
  readonly capabilities = {
    discovery: true,
    schemaDiscovery: true,
    submission: false,
    verification: false,
    publicDiscoverySupported: true,
    authorizedSubmissionSupported: true,
    publicFormSubmissionSupported: false,
  };
}

/** Terminal adapter for anything Aplica cannot submit and verify end to end. */
class UnsupportedAdapter extends BaseAdapter {
  readonly name = "unsupported";
  readonly capabilities = {
    discovery: false,
    schemaDiscovery: false,
    submission: false,
    verification: false,
    publicDiscoverySupported: false,
    authorizedSubmissionSupported: false,
    publicFormSubmissionSupported: false,
  };
}

export const adapters: Record<string, AutoApplyAdapter> = {
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  workable: new WorkableAdapter(),
  unsupported: new UnsupportedAdapter(),
};

export function getAdapter(name: string | null | undefined): AutoApplyAdapter {
  if (!name) return adapters["unsupported"]!;
  return adapters[name] ?? adapters["unsupported"]!;
}

/** Blocked requirements that permanently disqualify a job from Auto Apply. */
export const blockedRequirements = [
  "captcha",
  "mfa",
  "unsupported_login",
  "human_verification",
  "third_party_account",
] as const;

export function hasBlockedRequirement(signals: string[]): boolean {
  return signals.some((signal) => blockedRequirements.includes(signal as (typeof blockedRequirements)[number]));
}
