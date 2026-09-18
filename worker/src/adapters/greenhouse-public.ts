import { createPublicFormAdapter } from "./public-form.js";

/**
 * First supported family: the public Greenhouse job board application form
 * (job-boards.greenhouse.io / boards.greenhouse.io). Public form automation
 * only — no Harvest/authorized API credentials are used here.
 */
export const greenhousePublicAdapter = createPublicFormAdapter({
  id: "greenhouse_public_form",
  version: "1.0.0",
  atsType: "greenhouse",
  hostPatterns: [/^job-boards\.greenhouse\.io$/i, /^boards\.greenhouse\.io$/i, /^job-boards\.eu\.greenhouse\.io$/i],
  formSelector: "form#application-form, form[id*='application'], main form",
  submitSelectors: ["button#submit_app", "button[type='submit']", "input[type='submit']"],
});
