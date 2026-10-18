import { createPublicFormAdapter } from "./public-form.js";

export const ashbyPublicAdapter = createPublicFormAdapter({
  id: "ashby_public_form",
  version: "0.2.0",
  atsType: "ashby",
  hostPatterns: [/^jobs\.ashbyhq\.com$/i],
  formSelector: "form, [data-testid*='application'] form",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  activateSelectors: [
    "a[href*='application']",
    "button:has-text('Apply')",
    "a:has-text('Apply')",
  ],
});
