import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AdminContext = {
  supabase: {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error?: { message: string } | null }>;
  };
  userId: string;
};

async function assertAdmin(context: AdminContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

export const syncGreenhouseBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      boardToken: string;
      companyName: string;
      careersUrl?: string;
    }) => {
      const boardToken = data.boardToken.trim();
      const companyName = data.companyName.trim();

      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(boardToken)) {
        throw new Error("Board token inválido.");
      }
      if (!companyName || companyName.length > 200) {
        throw new Error("Ingresá el nombre de la empresa.");
      }

      let careersUrl: string | null = null;
      if (data.careersUrl?.trim()) {
        const parsed = new URL(data.careersUrl.trim());
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error("Careers URL inválida.");
        }
        careersUrl = parsed.toString();
      }

      return { boardToken, companyName, careersUrl };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { syncGreenhouseSource } = await import("@/lib/job-sync.server");

    return syncGreenhouseSource({
      boardToken: data.boardToken,
      companyName: data.companyName,
      careersUrl: data.careersUrl,
      requestedBy: context.userId,
    });
  });

export const syncAllGreenhouseBoards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncAllRegisteredGreenhouseSources } = await import(
      "@/lib/job-sync.server"
    );

    return syncAllRegisteredGreenhouseSources({
      requestedBy: context.userId,
      concurrency: 3,
    });
  });


export type DetectedJobSource = {
  atsType:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "smartrecruiters"
    | "workable"
    | "workday";
  identifier: string;
  careersUrl: string;
  workday?: { host: string; tenant: string; site: string };
};

function looksLikeLocale(value: string | undefined) {
  return Boolean(value && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(value));
}

export function detectJobSourceFromUrl(value: string): DetectedJobSource {
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Careers URL inválida.");
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);
  const first = segments[0]?.trim();

  if (
    host === "job-boards.greenhouse.io" ||
    host === "boards.greenhouse.io" ||
    host === "job-boards.eu.greenhouse.io"
  ) {
    if (!first) throw new Error("No pudimos detectar el board de Greenhouse.");
    return { atsType: "greenhouse", identifier: first, careersUrl: url.toString() };
  }

  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    if (!first) throw new Error("No pudimos detectar el site de Lever.");
    return { atsType: "lever", identifier: first, careersUrl: url.toString() };
  }

  if (host === "jobs.ashbyhq.com") {
    if (!first) throw new Error("No pudimos detectar el board de Ashby.");
    return { atsType: "ashby", identifier: first, careersUrl: url.toString() };
  }

  if (
    host === "jobs.smartrecruiters.com" ||
    host === "careers.smartrecruiters.com"
  ) {
    if (!first) {
      throw new Error("No pudimos detectar la empresa de SmartRecruiters.");
    }
    return {
      atsType: "smartrecruiters",
      identifier: first,
      careersUrl: url.toString(),
    };
  }

  if (host === "apply.workable.com") {
    if (!first) throw new Error("No pudimos detectar la cuenta de Workable.");
    return {
      atsType: "workable",
      identifier: first,
      careersUrl: url.toString(),
    };
  }

  if (
    host.endsWith(".workable.com") &&
    host !== "www.workable.com" &&
    host !== "apply.workable.com"
  ) {
    const account = host.split(".")[0];
    if (!account) throw new Error("No pudimos detectar la cuenta de Workable.");
    return {
      atsType: "workable",
      identifier: account,
      careersUrl: url.toString(),
    };
  }

  if (
    host.endsWith(".myworkdayjobs.com") ||
    host.endsWith(".myworkdaysite.com")
  ) {
    const tenant = host.split(".")[0];
    const site =
      (looksLikeLocale(segments[0]) ? segments[1] : segments[0]) || "External";
    if (!tenant || !site) throw new Error("No pudimos detectar el sitio de Workday.");
    return {
      atsType: "workday",
      identifier: `${host}|${site}`,
      careersUrl: url.toString(),
      workday: { host, tenant, site },
    };
  }

  throw new Error(
    "Por ahora detectamos Greenhouse, Lever, Ashby, SmartRecruiters, Workable y Workday.",
  );
}

export const syncDetectedJobBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { companyName: string; careersUrl: string }) => {
    const companyName = data.companyName.trim();
    if (!companyName || companyName.length > 200) {
      throw new Error("Ingresá el nombre de la empresa.");
    }
    const source = detectJobSourceFromUrl(data.careersUrl);
    return { companyName, ...source };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);

    if (data.atsType === "greenhouse") {
      const { syncGreenhouseSource } = await import("@/lib/job-sync.server");
      return {
        atsType: data.atsType,
        identifier: data.identifier,
        ...(await syncGreenhouseSource({
          boardToken: data.identifier,
          companyName: data.companyName,
          careersUrl: data.careersUrl,
          requestedBy: context.userId,
        })),
      };
    }

    if (data.atsType === "lever") {
      const { syncLeverSource } = await import("@/lib/job-sources/lever");
      return {
        atsType: data.atsType,
        identifier: data.identifier,
        ...(await syncLeverSource({
          site: data.identifier,
          companyName: data.companyName,
          careersUrl: data.careersUrl,
          eu: /jobs\.eu\.lever\.co/i.test(data.careersUrl),
        })),
      };
    }

    if (data.atsType === "ashby") {
      const { syncAshbySource } = await import("@/lib/job-sources/ashby");
      return {
        atsType: data.atsType,
        identifier: data.identifier,
        ...(await syncAshbySource({
          boardName: data.identifier,
          companyName: data.companyName,
          careersUrl: data.careersUrl,
        })),
      };
    }

    if (data.atsType === "smartrecruiters") {
      const { syncSmartRecruitersSource } = await import(
        "@/lib/job-sources/smartrecruiters"
      );
      return {
        atsType: data.atsType,
        identifier: data.identifier,
        ...(await syncSmartRecruitersSource({
          companyIdentifier: data.identifier,
          companyName: data.companyName,
          careersUrl: data.careersUrl,
        })),
      };
    }

    if (data.atsType === "workable") {
      const { syncWorkableSource } = await import("@/lib/job-sources/workable");
      return {
        atsType: data.atsType,
        identifier: data.identifier,
        ...(await syncWorkableSource({
          account: data.identifier,
          companyName: data.companyName,
          careersUrl: data.careersUrl,
        })),
      };
    }

    const workday = data.workday;
    if (!workday) throw new Error("Configuración de Workday incompleta.");
    const { syncWorkdaySource } = await import("@/lib/job-sources/workday");
    return {
      atsType: data.atsType,
      identifier: data.identifier,
      ...(await syncWorkdaySource({
        ...workday,
        companyName: data.companyName,
        careersUrl: data.careersUrl,
      })),
    };
  });

export const syncAllRegisteredJobSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncAllRegisteredSources } = await import("@/lib/job-sync-multisource.server");
    return syncAllRegisteredSources({ requestedBy: context.userId, concurrency: 4 });
  });
