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

export const syncJobBoardUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string; companyName?: string }) => {
    const url = data.url.trim();
    if (!url) throw new Error("Ingresá la URL pública del careers board.");

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("URL inválida.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL inválida.");
    }

    const companyName = data.companyName?.trim() || null;
    if (companyName && companyName.length > 200) {
      throw new Error("El nombre de la empresa es demasiado largo.");
    }

    return { url: parsed.toString(), companyName };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const [{ detectJobBoardUrl }, { syncJobSource }] = await Promise.all([
      import("@/lib/job-sources/registry"),
      import("@/lib/job-sync.server"),
    ]);

    const detected = detectJobBoardUrl(data.url);
    return syncJobSource({
      provider: detected.provider,
      identifier: detected.identifier,
      companyName: data.companyName ?? detected.companyName,
      careersUrl: detected.careersUrl,
      requestedBy: context.userId,
    });
  });

export const syncAllJobBoards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncAllRegisteredJobSources } = await import(
      "@/lib/job-sync.server"
    );

    return syncAllRegisteredJobSources({
      requestedBy: context.userId,
      concurrency: 4,
    });
  });

// Backwards-compatible actions used by older admin UI/deep links.
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
