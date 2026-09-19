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
