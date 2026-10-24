import { expect, test } from "bun:test";
import { applicationAction, applicationStatusLabel, matchesApplicationFilter } from "./application-status";
test("only verified applications count as sent; unverified needs attention", () => {
  for (const status of ["queued", "submitting", "submitted_unverified", "failed_permanent", "unsupported"]) {
    expect(matchesApplicationFilter(status, "Enviadas")).toBe(false);
  }
  expect(matchesApplicationFilter("verified", "Enviadas")).toBe(true);
  expect(applicationStatusLabel("submitted_unverified")).toBe("Envío sin confirmar");
  expect(matchesApplicationFilter("submitted_unverified", "Necesitan atención")).toBe(true);
  expect(applicationAction("VERIFICATION_FAILED", "submitted_unverified")).toContain("antes de volver a aplicar");
  expect(applicationAction("CAPTCHA_PRESENT", "unsupported")).toContain("CAPTCHA");
});
