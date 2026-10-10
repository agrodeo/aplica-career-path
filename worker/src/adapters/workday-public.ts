import { createPublicFormAdapter } from "./public-form.js";

export const workdayPublicAdapter = createPublicFormAdapter({
  id: "workday_public_form",
  version: "0.1.0",
  atsType: "workday",
  hostPatterns: [/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/i],
  formSelector: "form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateSelectors: [
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
