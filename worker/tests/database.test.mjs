import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = async (name) => readFile(new URL(`../../drizzle/migrations/${name}.sql`, import.meta.url), "utf8");
test("profile persistence is atomic, repeatable, isolated by RLS and requires explicit consent", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    await db.exec((await migration("0000_auto_apply_core_schema")).split("-- ============ REALTIME ============")[0]);
    await db.exec("alter table profiles add column master_profile_version integer not null default 1");
    await db.exec(await migration("20261018042229_persist_verified_onboarding"));
    await db.exec(`set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000011'`);
    const data = { confirmed: true, autoApplyAuthorized: false, profile: { firstName: "Ana", lastName: "Perez", email: "ana@example.com", company: "Fixture", role: "Nurse", startDate: "2020-01-01", institution: "School", degree: "Nursing", language: "Spanish", level: "Native", achievementList: [] }, selected: { skills: ["Nursing"], mode: ["Presencial"], industry: [] }, roles: ["Nurse"], locations: ["Argentina"], employmentTypes: ["full_time"], seniority: [] };
    await db.query("select save_onboarding_profile($1)", [JSON.stringify(data)]);
    await db.query("select save_onboarding_profile($1)", [JSON.stringify(data)]);
    assert.equal((await db.query("select count(*)::int n from experiences")).rows[0].n, 1);
    assert.equal((await db.query("select master_profile_version n from profiles")).rows[0].n, 2);
    assert.equal((await db.query("select authorized from auto_apply_consents")).rows[0].authorized, false);
    await assert.rejects(db.query("select save_onboarding_profile($1)", [JSON.stringify({ ...data, profile: { ...data.profile, firstName: "Wrong", startDate: "invalid" } })]));
    assert.equal((await db.query("select first_name from profiles")).rows[0].first_name, "Ana");
    await db.exec(`set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012'`);
    assert.equal((await db.query("select count(*)::int n from profiles")).rows[0].n, 0);

    // Credits change only when the worker explicitly reports verification.
    await db.exec(`reset role; insert into jobs(id,external_job_id,title) values('00000000-0000-0000-0000-000000000021','fixture','Nurse');
      insert into application_attempts(id,user_id,job_id,status) values('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021','submitting');
      insert into application_queue(id,user_id,job_id,attempt_id) values('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031');
      select update_attempt_status('00000000-0000-0000-0000-000000000041','submitted_unverified');`);
    assert.equal((await db.query("select count(*)::int n from application_credits")).rows[0].n, 0);
    await db.exec(`select complete_application('00000000-0000-0000-0000-000000000041','FIXTURE123'); select complete_application('00000000-0000-0000-0000-000000000041','FIXTURE123')`);
    assert.equal((await db.query("select consumed from application_credits")).rows[0].consumed, 1);
    assert.equal((await db.query("select status from application_attempts")).rows[0].status, "verified");
  } finally { await db.close(); }
});

test("inspection claims honor priority, do not reclaim live leases and recover abandoned leases", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table adapter_inspections(id uuid primary key default gen_random_uuid(),url text,status text,created_at timestamptz default now(),locked_at timestamptz,worker_id text);
      create table jobs(application_url text,is_active boolean,country text,location text);`);
    await db.exec(await migration("20261018042058_bound_auto_apply_inspection_claims"));
    await db.exec(`insert into adapter_inspections(url,status) values('https://boards.greenhouse.io/test/1','queued'),('https://jobs.ashbyhq.com/test/2','queued'),('https://jobs.lever.co/test/3','queued');`);
    const first = (await db.query("select * from claim_inspection('first',2)")).rows;
    assert.equal(first.length, 2);
    assert.ok(first.some((row) => row.url.includes("greenhouse")));
    assert.equal((await db.query("select * from claim_inspection('second',2)")).rows.length, 1);
    assert.equal((await db.query("select * from claim_inspection('third',2)")).rows.length, 0);
    await db.exec("update adapter_inspections set locked_at=now()-interval '30 minutes' where worker_id='first'");
    assert.equal((await db.query("select * from claim_inspection('recovered',2)")).rows.length, 2);
  } finally { await db.close(); }
});
