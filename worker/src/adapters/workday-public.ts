import { createPublicFormAdapter } from "./public-form.js";

export const workdayPublicAdapter = createPublicFormAdapter({
  id: "workday_public_form",
  version: "0.4.0",
  atsType: "workday",
  hostPatterns: [/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/i],
  formSelector: "form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateNames: ["Apply", "Apply Manually"],
  cookieDeclineSelectors: ["button:text-is('Decline')"],
  activateSelectors: [
    "button:has-text('Apply')",
    "a:has-text('Apply')",
    "button:has-text('Apply Manually'), [role='button']:has-text('Apply Manually')",
  ],
});
