import { createPublicFormAdapter } from "./public-form.js";

/**
 * Second family, intentionally NOT enabled in the registry yet: the milestone is
 * one adapter working end to end first. Kept here so enabling it later is a
 * one-line change once Greenhouse public forms are proven.
 */
export const leverPublicAdapter = createPublicFormAdapter({
  id: "lever_public_form",
  version: "0.1.0",
  atsType: "lever",
  hostPatterns: [/^jobs\.lever\.co$/i, /^jobs\.eu\.lever\.co$/i],
  formSelector: "form.application-form, form[action*='apply']",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
});
