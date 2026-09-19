import { ashbyProvider } from "@/lib/job-sources/ashby";
import { greenhouseProvider } from "@/lib/job-sources/greenhouse";
import { leverProvider } from "@/lib/job-sources/lever";
import type {
  AtsProvider,
  JobSourceProvider,
} from "@/lib/job-sources/types";

export const jobSourceProviders: Record<AtsProvider, JobSourceProvider> = {
  greenhouse: greenhouseProvider,
  lever: leverProvider,
  ashby: ashbyProvider,
};

export const supportedAtsProviders = Object.keys(
  jobSourceProviders,
) as AtsProvider[];

function prettyCompanyName(identifier: string) {
  return identifier
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export function detectJobBoardUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);
  const identifier = pathParts[0]?.trim() ?? "";

  if (
    host === "job-boards.greenhouse.io" ||
    host === "boards.greenhouse.io" ||
    host.endsWith(".greenhouse.io")
  ) {
    if (!identifier) throw new Error("No encontramos el board de Greenhouse.");
    return {
      provider: "greenhouse" as const,
      identifier,
      companyName: prettyCompanyName(identifier),
      careersUrl: url.toString(),
    };
  }

  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    if (!identifier) throw new Error("No encontramos la empresa en Lever.");
    return {
      provider: "lever" as const,
      identifier,
      companyName: prettyCompanyName(identifier),
      careersUrl: url.toString(),
    };
  }

  if (host === "jobs.ashbyhq.com") {
    if (!identifier) throw new Error("No encontramos el board de Ashby.");
    return {
      provider: "ashby" as const,
      identifier,
      companyName: prettyCompanyName(identifier),
      careersUrl: url.toString(),
    };
  }

  throw new Error(
    "URL no soportada todavía. Usá un board público de Greenhouse, Lever o Ashby.",
  );
}

export function getJobSourceProvider(provider: AtsProvider) {
  return jobSourceProviders[provider];
}
