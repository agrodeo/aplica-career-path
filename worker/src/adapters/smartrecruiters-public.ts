import { createPublicFormAdapter } from "./public-form.js";

export const smartRecruitersPublicAdapter = createPublicFormAdapter({
  id: "smartrecruiters_public_form",
  version: "0.2.0",
  atsType: "smartrecruiters",
  hostPatterns: [/^jobs\.smartrecruiters\.com$/i, /^careers\.smartrecruiters\.com$/i],
  formSelector: "form[action*='apply'], form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateSelectors: [
    "a[href*='apply']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
