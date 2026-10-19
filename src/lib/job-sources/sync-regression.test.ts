import { afterEach, describe, expect, test } from "bun:test";
import { syncJobSource } from "../job-sync.server";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fixture(mode: "existing" | "lookup-error" | "insert-race" | "pending-error" | "enqueue") {
  process.env["SUPABASE_URL"] = "https://fixture.supabase.co";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "sb_secret_offline_test_only_not_a_credential";
  const calls: { path: string; method: string; query: URLSearchParams; body: any }[] = [];
  let lookups = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ path: url.pathname, method, query: url.searchParams, body });
    if (url.hostname === "api.smartrecruiters.com") {
      if (/\/postings\/\d+$/.test(url.pathname)) {
        const id = url.pathname.split("/").at(-1);
        return Response.json({
          id,
          name: `Nurse ${id}`,
          jobAd: { sections: { jobDescription: { text: "Full description" } } },
        });
      }
      return Response.json({
        totalFound: 21,
        content: Array.from({ length: 21 }, (_, i) => ({ id: String(i), name: `Nurse ${i}` })),
      });
    }
    if (url.hostname !== "fixture.supabase.co")
      throw new Error(`Unexpected network call: ${url.hostname}`);
    if (url.pathname === "/rest/v1/companies" && method === "GET") {
      lookups++;
      if (mode === "lookup-error")
        return Response.json({ message: "Denied", code: "42501" }, { status: 403 });
      return Response.json(mode === "insert-race" && lookups === 1 ? [] : [{ id: "company-1" }]);
    }
    if (url.pathname === "/rest/v1/companies" && method === "POST")
      return Response.json({ message: "Duplicate board", code: "23505" }, { status: 409 });
    if (url.pathname === "/rest/v1/job_sources") return Response.json({ id: "source-1" });
    if (url.pathname === "/rest/v1/rpc/refresh_source_inspection_priorities") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/rpc/enqueue_job_inspections") return Response.json(1);
    if (url.pathname === "/rest/v1/jobs" && method === "GET") return Response.json(mode === "pending-error" || mode === "enqueue" ? [{
      id: "job-1", external_job_id: "0", application_url: "https://jobs.smartrecruiters.com/Hospital/0", last_verified_at: null,
    }] : []);
    if (url.pathname === "/rest/v1/adapter_inspections" && method === "GET")
      return mode === "enqueue" ? Response.json([]) : Response.json({ message: "Inspection queue unavailable", code: "PGRST002" }, { status: 503 });
    if (method === "PATCH" || method === "POST") return new Response(null, { status: 204 });
    throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`);
  }) as typeof fetch;
  return calls;
}

const input = {
  provider: "smartrecruiters" as const,
  identifier: "Hospital",
  companyName: "Hospital",
};

describe("inventory registry and description regressions", () => {
  test("queues through the conflict-safe RPC and counts only inserted inspections", async () => {
    const calls = fixture("enqueue");
    const result = await syncJobSource({ ...input, requestedBy: "00000000-0000-0000-0000-000000000001" });
    expect(result.inspectionsQueued).toBe(1);
    expect(calls.find(call => call.path.endsWith("rpc/enqueue_job_inspections"))?.body._urls).toEqual(["https://jobs.smartrecruiters.com/Hospital/0"]);
    expect(calls.some(call => call.path.endsWith("adapter_inspections") && call.method === "POST")).toBe(false);
  });
  test("an unavailable inspection lookup cannot create duplicate pending inspections", async () => {
    const calls = fixture("pending-error");
    await expect(syncJobSource({ ...input, requestedBy: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow("Inspection queue unavailable");
    expect(calls.some(call => call.path.endsWith("adapter_inspections") && call.method === "POST")).toBe(false);
    expect(calls.some(call => call.path.endsWith("jobs") && call.method === "PATCH" && call.body?.auto_apply_eligible === false)).toBe(false);
  }, 15000);
  test("chooses one active company and keeps unenriched jobs out of description-writing batches", async () => {
    const calls = fixture("existing");
    await syncJobSource(input);
    const lookup = calls.find((call) => call.path.endsWith("companies") && call.method === "GET")!;
    expect(lookup.query.get("limit")).toBe("1");
    expect(lookup.query.get("active")).toBe("eq.true");
    const writes = calls.filter((call) => call.path.endsWith("jobs") && call.method === "POST");
    expect(writes).toHaveLength(2);
    expect(writes[0]!.body).toHaveLength(20);
    expect(writes[0]!.body.every((row: any) => row.description === "Full description")).toBe(true);
    expect(writes[1]!.body).toHaveLength(1);
    expect("description" in writes[1]!.body[0]).toBe(false);
    expect(calls.some((call) => call.path.endsWith("companies") && call.method === "POST")).toBe(
      false,
    );
  });

  test("a failed lookup cannot turn into another company insert", async () => {
    const calls = fixture("lookup-error");
    await expect(syncJobSource(input)).rejects.toThrow("Denied");
    expect(calls.some((call) => call.path.endsWith("companies") && call.method === "POST")).toBe(
      false,
    );
  });

  test("uses the winning company when another sync lane inserts first", async () => {
    const calls = fixture("insert-race");
    const result = await syncJobSource(input);
    expect(result.companyId).toBe("company-1");
    expect(result.discovered).toBe(21);
    expect(
      calls.filter((call) => call.path.endsWith("companies") && call.method === "POST"),
    ).toHaveLength(1);
  });
});
