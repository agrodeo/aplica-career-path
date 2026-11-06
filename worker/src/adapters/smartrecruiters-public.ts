import { createPublicFormAdapter } from "./public-form.js";

export const smartRecruitersPublicAdapter = createPublicFormAdapter({
  id: "smartrecruiters_public_form",
  version: "0.3.0",
  atsType: "smartrecruiters",
  hostPatterns: [/^jobs\.smartrecruiters\.com$/i, /^careers\.smartrecruiters\.com$/i],
  formSelector: "form[action*='apply'], form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateSelectors: [
    'a:text-is("I\'m interested")',
    'button:text-is("I\'m interested")',
    "a[href*='apply']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
