import { createPublicFormAdapter } from "./public-form.js";

export const workablePublicAdapter = createPublicFormAdapter({
  id: "workable_public_form",
  version: "0.1.1",
  atsType: "workable",
  hostPatterns: [/^apply\.workable\.com$/i],
  formSelector: "form[action*='apply'], form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateSelectors: [
    "a[href*='/apply/']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
