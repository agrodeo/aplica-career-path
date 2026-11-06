import { createPublicFormAdapter } from "./public-form.js";

export const workablePublicAdapter = createPublicFormAdapter({
  id: "workable_public_form",
  version: "0.4.0",
  atsType: "workable",
  hostPatterns: [/^apply\.workable\.com$/i],
  formSelector: "form[action*='apply'], form",
  cookieDeclineSelectors: ["button:text-is('Decline all')"],
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateNames: ["Apply for this job", "Apply"],
  activateSelectors: [
    "a[href*='/apply/']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
