import { createPublicFormAdapter } from "./public-form.js";

/**
 * Lever listings and application forms use separate URLs. Open the explicit
 * application link before inspecting fields on a listing page.
 */
export const leverPublicAdapter = createPublicFormAdapter({
  id: "lever_public_form",
  version: "0.3.0",
  atsType: "lever",
  hostPatterns: [/^jobs\.lever\.co$/i, /^jobs\.eu\.lever\.co$/i],
  formSelector: "form#application-form, form.application-form, form[action*='apply']",
  submitSelectors: ["button[type='submit']", "input[type='submit']"],
  externalSubmitNames: ["Submit application"],
  activateSelectors: ["a[href$='/apply']", "a[href*='/apply?']"],
});
