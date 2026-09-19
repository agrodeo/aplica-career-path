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
    const { syncGreenhouseTarget } = await import("@/lib/discovery.server");
    return syncGreenhouseTarget({
      ...data,
      requestedBy: context.userId,
    });
  });

export const syncAllGreenhouseBoards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { syncDueGreenhouseBoards } = await import("@/lib/discovery.server");
    return syncDueGreenhouseBoards(50);
  });

export const getDiscoveryHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("job_sources")
      .select(
        "id,name,type,discovery_enabled,active,connection_status,last_synced_at,last_sync_status,last_sync_error,last_job_count",
      )
      .eq("discovery_enabled", true)
      .eq("active", true)
      .order("last_synced_at", { ascending: false, nullsFirst: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      connectionStatus: source.connection_status,
      lastSyncedAt: source.last_synced_at,
      lastSyncStatus: source.last_sync_status,
      lastSyncError: source.last_sync_error,
      lastJobCount: source.last_job_count,
    }));
  });
