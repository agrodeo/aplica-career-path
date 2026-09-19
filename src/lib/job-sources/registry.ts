import { ashbyProvider } from "@/lib/job-sources/ashby";
import { greenhouseProvider } from "@/lib/job-sources/greenhouse";
import { leverProvider } from "@/lib/job-sources/lever";
import { workdayProvider } from "@/lib/job-sources/workday";
import { smartRecruitersProvider } from "@/lib/job-sources/smartrecruiters";
import type {
  AtsProvider,
  JobSourceProvider,
} from "@/lib/job-sources/types";

export const jobSourceProviders: Record<AtsProvider, JobSourceProvider> = {
  greenhouse: greenhouseProvider,
  lever: leverProvider,
  ashby: ashbyProvider,
  workday: workdayProvider,
  smartrecruiters: smartRecruitersProvider,
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

  if (
    host === "jobs.smartrecruiters.com" ||
    host === "careers.smartrecruiters.com"
  ) {
    if (!identifier) {
      throw new Error("No encontramos la empresa en SmartRecruiters.");
    }
    return {
      provider: "smartrecruiters" as const,
      identifier,
      companyName: prettyCompanyName(identifier),
      careersUrl: url.toString(),
    };
  }

  const workdayHost = host.match(
    /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/i,
  );
  if (workdayHost) {
    const tenant = workdayHost[1];
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0])) {
      parts.shift();
    }
    if (!parts[0]) {
      throw new Error(
        "La URL de Workday tiene que incluir el careers site, no sólo el dominio.",
      );
    }
    return {
      provider: "workday" as const,
      // Workday needs tenant + shard hostname + site. The full public board URL
      // is the stable identifier because all three are encoded in it.
      identifier: url.toString(),
      companyName: prettyCompanyName(tenant),
      careersUrl: url.toString(),
    };
  }

  throw new Error(
    "URL no soportada todavía. Usá un board público de Greenhouse, Lever, Ashby, SmartRecruiters o Workday.",
  );
}

export function getJobSourceProvider(provider: AtsProvider) {
  return jobSourceProviders[provider];
}
