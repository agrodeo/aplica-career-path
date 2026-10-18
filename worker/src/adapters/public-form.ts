import type { Page } from "playwright";
import { answerKeyFor, canonicalKeyFor, findDeclineOption, isDemographicQuestion } from "./field-map.js";
import { prepareAnswers } from "../application/answers.js";
import { type ApplicationAdapter, type ApplicationSchema, type EligibilityResult, type FieldType, type InspectedField, type MasterProfile, type SubmissionContext, type SubmissionResult, type VerificationResult } from "./types.js";
import { ApplicationError } from "../utils/errors.js";

const CAPTCHA_SIGNALS = ["iframe[src*='recaptcha']", "iframe[src*='hcaptcha']", ".g-recaptcha", "[data-sitekey]", "iframe[title*='challenge']", "#cf-challenge-running"];
const LOGIN_SIGNALS = [/sign in to (apply|continue)/i, /log in to (apply|continue)/i, /create an account to apply/i, /iniciar sesi[oó]n para postular/i];
const SUCCESS_PATTERNS = [
  /thank you for applying/i,
  /application (was )?(submitted|received)/i,
  /we(?:'| ha)ve received your application/i,
  /your application has been submitted/i,
  /gracias por (tu|su) postulaci[oó]n/i,
  /postulaci[oó]n enviada/i,
];
const APPLICATION_ID_PATTERN = /(application|confirmation|reference)\s*(id|number|#)\s*[:#]?\s*([A-Za-z0-9-]{5,})/i;

export interface PublicFormAdapterOptions {
  id: string;
  version: string;
  atsType: string;
  hostPatterns: RegExp[];
  formSelector: string;
  submitSelectors: string[];
  activateSelectors?: string[];
}

/**
 * Public application form automation. It reads the form the employer publishes,
 * fills only fields it understands from verified data, and submits it the same
 * way a person would. It never bypasses CAPTCHA, login, MFA or anti-bot controls:
 * when one is present the job becomes unsupported.
 */
export function createPublicFormAdapter(options: PublicFormAdapterOptions): ApplicationAdapter {
  return {
    id: options.id,
    version: options.version,
    mechanism: "PUBLIC_APPLICATION_FORM",

    supports(url: string) {
      try {
        const host = new URL(url).host;
        return options.hostPatterns.some((pattern) => pattern.test(host));
      } catch {
        return false;
      }
    },

    async inspect(url: string, page: Page): Promise<ApplicationSchema> {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      if (!response || response.status() >= 400) {
        if (response && [403, 429].includes(response.status())) {
          throw new ApplicationError("AUTOMATION_BLOCKED", `The application page refused automated access (${response.status()}).`);
        }
        if (response?.status() === 404 || response?.status() === 410) {
          throw new ApplicationError("JOB_EXPIRED", "The application page no longer exists.");
        }
        throw new ApplicationError("NETWORK_ERROR", `Could not load the application page (${response?.status() ?? "no response"}).`);
      }

      // ATS clients hydrate after DOMContentLoaded. Wait for application controls,
      // rather than treating the initial HTML shell as the finished form.
      await waitForApplicationControls(page, options.formSelector);
      let selectedFormSelector = await markBestApplicationForm(page, options.formSelector);
      let form = selectedFormSelector ? page.locator(selectedFormSelector).first() : page.locator(options.formSelector).first();
      let formExists = Boolean(selectedFormSelector) && (await form.count()) > 0;

      if (!formExists && options.activateSelectors?.length) {
        for (const selector of options.activateSelectors) {
          const trigger = page.locator(selector).first();
          if ((await trigger.count()) === 0 || !(await trigger.isVisible().catch(() => false))) continue;
          await trigger.click().catch(() => undefined);
          await waitForApplicationControls(page, options.formSelector);
          selectedFormSelector = await markBestApplicationForm(page, options.formSelector);
          form = selectedFormSelector ? page.locator(selectedFormSelector).first() : page.locator(options.formSelector).first();
          formExists = Boolean(selectedFormSelector) && (await form.count()) > 0;
          if (formExists) break;
        }
      }

      if (formExists && selectedFormSelector) {
        // Upload components can mount after the identity fields. Include native
        // controls associated from outside the form when waiting for them.
        await page.waitForFunction((selector) => {
          const candidate = document.querySelector(selector);
          const controls = candidate instanceof HTMLFormElement ? Array.from(candidate.elements) : Array.from(candidate?.querySelectorAll('input[type="file"]') ?? []);
          return controls.some((el) => el instanceof HTMLInputElement && el.type === "file");
        }, selectedFormSelector, { timeout: 3000 }).catch(() => undefined);
      }

      const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? "";
      const captchaDetected = await detectCaptcha(page);
      const loginRequired = LOGIN_SIGNALS.some((pattern) => pattern.test(bodyText));
      const fields = formExists && selectedFormSelector ? await readFields(page, selectedFormSelector, url) : [];

      let submitSelector: string | null = null;
      for (const selector of options.submitSelectors) {
        if (!selectedFormSelector) break;
        const buttons = page.locator(selectedFormSelector).locator(selector);
        for (let index = 0; index < await buttons.count(); index++) {
          const button = buttons.nth(index);
          const label = (await button.textContent()) || (await button.getAttribute("value")) || "";
          // A multi-step wizard's Next button is not a final submission control.
          if (/^(next|continue|save|siguiente|continuar)\b/i.test(label.trim())) continue;
          if (!(await button.isVisible())) continue;
          await button.evaluate((element) => element.setAttribute("data-aplica-submit", "true"));
          submitSelector = `${selectedFormSelector} [data-aplica-submit="true"]`;
          break;
        }
        if (submitSelector) break;
      }

      const requiredFields = fields.filter((f) => f.required).map((f) => f.label);
      const unknownRequiredFields = fields
        .filter(
          (field) =>
            field.required &&
            ((field.type === "file" && field.canonicalKey !== "resume") ||
              field.type === "unknown") &&
            !(field.demographic && field.options && findDeclineOption(field.options)),
        )
        .map((field) => field.label);
      const supportsFileUpload = fields.some((f) => f.type === "file" && f.canonicalKey === "resume");

      return {
        url,
        adapter: options.id,
        adapterVersion: options.version,
        atsType: options.atsType,
        fields,
        requiredFields,
        unknownRequiredFields,
        supportsFileUpload,
        supportsAutoSubmit: Boolean(submitSelector) && !captchaDetected && !loginRequired,
        captchaDetected,
        loginRequired,
        submitSelector,
        valid: formExists && Boolean(submitSelector) && !captchaDetected && !loginRequired,
      };
    },

    async canSubmit(schema: ApplicationSchema, profile: MasterProfile): Promise<EligibilityResult> {
      const reasons: string[] = [];
      if (schema.captchaDetected) return { eligible: false, failureCode: "CAPTCHA_PRESENT", reasons: ["La postulación usa CAPTCHA."], unknownRequiredFields: [] };
      if (schema.loginRequired) return { eligible: false, failureCode: "LOGIN_REQUIRED", reasons: ["La postulación requiere iniciar sesión."], unknownRequiredFields: [] };
      if (!schema.valid || !schema.supportsAutoSubmit) {
        return { eligible: false, failureCode: "UNSUPPORTED_FIELD", reasons: ["El formulario no se puede completar y enviar automáticamente."], unknownRequiredFields: schema.unknownRequiredFields };
      }
      if (!schema.supportsFileUpload) reasons.push("El formulario no acepta subir un CV.");

      // Global adapter limitations must stay separate from user-specific answer gaps.
      // A normal text/select/radio question is structurally supported: Aplica asks
      // the user once, stores the explicit answer under field.answerKey, and reuses it.
      const unsupportedFields: string[] = [...schema.unknownRequiredFields];
      for (const field of schema.fields) {
        if (!field.required) continue;
        if ((field.type === "file" && field.canonicalKey !== "resume") || field.type === "unknown") unsupportedFields.push(field.label);
      }

      if (unsupportedFields.length || reasons.length) {
        return {
          eligible: false,
          failureCode: "UNSUPPORTED_FIELD",
          reasons: [
            ...reasons,
            ...(unsupportedFields.length
              ? [`Campos obligatorios no soportados: ${unsupportedFields.join(", ")}`]
              : []),
          ],
          unknownRequiredFields: unsupportedFields,
        };
      }

      // Match submission's resolver, including exact option matching.
      try {
        prepareAnswers(schema, profile, { id: "eligibility", title: "", description: "", company: "", location: null, applicationUrl: schema.url, atsType: schema.atsType });
      } catch (error) {
        if (!(error instanceof ApplicationError)) throw error;
        return { eligible: false, failureCode: error.code, reasons: [error.message], unknownRequiredFields: [] };
      }

      return { eligible: true, reasons: [], unknownRequiredFields: [] };
    },

    async submit(context: SubmissionContext): Promise<SubmissionResult> {
      const { page, schema, answers, resumePath } = context;

      for (const answer of answers) {
        const locator = page.locator(answer.field.selector).first();
        if ((await locator.count()) === 0) throw new ApplicationError("FORM_CHANGED", `Field disappeared: ${answer.field.label}`);
        try {
          switch (answer.field.type) {
            case "file":
              await locator.setInputFiles(resumePath);
              break;
            case "select":
              await locator.selectOption({ value: String(answer.value) });
              break;
            case "combobox":
              await selectComboboxOption(page, answer.field, String(answer.value));
              break;
            case "checkbox":
              await locator.setChecked(answer.value === true);
              break;
            case "radio":
              await page.locator(answer.field.selector).evaluateAll((elements, value) => {
                for (const el of elements) el.toggleAttribute("data-aplica-radio-choice", (el as HTMLInputElement).value === value);
              }, String(answer.value));
              await page.locator(`${answer.field.selector}[data-aplica-radio-choice]`).first().check();
              break;
            default:
              await locator.fill(String(answer.value));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (answer.field.type === "file") throw new ApplicationError("FILE_UPLOAD_FAILED", message);
          throw new ApplicationError("FORM_CHANGED", `Could not fill "${answer.field.label}": ${message}`);
        }
      }

      // Re-check right before submitting: a CAPTCHA can appear after interaction.
      if (await detectCaptcha(page)) throw new ApplicationError("CAPTCHA_PRESENT", "A CAPTCHA appeared before submission.");

      if (context.dryRun) {
        return { submitted: false, dryRun: true, page, adapter: options.id, adapterVersion: options.version, responseUrl: page.url(), pageText: null };
      }
      if (!schema.submitSelector) throw new ApplicationError("UNSUPPORTED_FIELD", "No submit control found.");

      const priorPageText = await page.locator("body").innerText();
      const priorUrl = page.url();
      await page.locator(schema.submitSelector).first().click();
      await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
      // SPAs can acknowledge submission after the first network-idle interval.
      await page.waitForFunction(({ patterns, before, url }) => {
        const text = document.body.innerText;
        return patterns.some((source) => new RegExp(source, "i").test(text) && !new RegExp(source, "i").test(before)) || location.href !== url;
      }, { patterns: [...SUCCESS_PATTERNS, APPLICATION_ID_PATTERN].map((pattern) => pattern.source), before: priorPageText, url: priorUrl }, { timeout: 10000 }).catch(() => undefined);
      const pageText = (await page.locator("body").innerText().catch(() => "")) ?? "";
      return { submitted: true, dryRun: false, page, adapter: options.id, adapterVersion: options.version, responseUrl: page.url(), pageText, priorPageText, priorUrl };
    },

    async verify(result: SubmissionResult): Promise<VerificationResult> {
      if (!result.submitted || result.dryRun) return { verified: false, verificationType: "none", verificationValue: null, screenshot: null };

      const text = result.pageText ?? "";
      const identifier = text.match(APPLICATION_ID_PATTERN);
      if (identifier?.[3] && identifier[3] !== result.priorPageText?.match(APPLICATION_ID_PATTERN)?.[3]) {
        return { verified: true, verificationType: "application_identifier", verificationValue: identifier[3], screenshot: await result.page.screenshot({ fullPage: true }) };
      }
      const success = SUCCESS_PATTERNS.find((pattern) => pattern.test(text) && !pattern.test(result.priorPageText ?? ""));
      if (success) {
        const matched = text.match(success)?.[0] ?? "confirmation";
        return { verified: true, verificationType: "success_message", verificationValue: matched.slice(0, 200), screenshot: await result.page.screenshot({ fullPage: true }) };
      }
      if (result.responseUrl !== result.priorUrl && /\/(?:confirmation|thank[-_%\s]*you|gracias)(?:[/?#]|$)/i.test(result.responseUrl ?? "")) {
        return { verified: true, verificationType: "confirmation_page", verificationValue: result.responseUrl, screenshot: await result.page.screenshot({ fullPage: true }) };
      }
      return { verified: false, verificationType: "none", verificationValue: null, screenshot: await result.page.screenshot({ fullPage: true }).catch(() => null) };
    },
  };
}

async function detectCaptcha(page: Page) {
  for (const selector of CAPTCHA_SIGNALS) {
    if ((await page.locator(selector).count()) > 0) return true;
  }
  return false;
}

async function waitForApplicationControls(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((candidateSelector) => {
    return Array.from(document.querySelectorAll(candidateSelector)).some((form) => {
      const controls = Array.from(form instanceof HTMLFormElement ? form.elements : form.querySelectorAll("input, textarea, select"));
      return controls.some((el) => el instanceof HTMLInputElement && el.type === "file") ||
        controls.filter((el) => el.matches('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="search"]), textarea, select')).length >= 2;
    });
  }, selector, { timeout: 5000 }).catch(() => undefined);
}

async function markBestApplicationForm(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((candidateSelector) => {
    for (const old of Array.from(document.querySelectorAll("[data-aplica-application-form]"))) {
      old.removeAttribute("data-aplica-application-form");
    }

    const candidates = Array.from(document.querySelectorAll(candidateSelector)) as HTMLElement[];
    if (!candidates.length) return null;

    const scored = candidates.map((candidate, index) => {
      const controls = Array.from(candidate instanceof HTMLFormElement ? candidate.elements : candidate.querySelectorAll("input, textarea, select"))
        .filter((el) => el.matches("input, textarea, select")) as HTMLInputElement[];
      const fileInputs = controls.filter((el) => el instanceof HTMLInputElement && el.type === "file").length;
      const usefulInputs = controls.filter((el) => {
        if (!(el instanceof HTMLInputElement)) return true;
        return !["hidden", "submit", "button", "search"].includes(el.type);
      }).length;
      const identityInputs = controls.filter((el) => {
        const haystack = [
          el.getAttribute("name"),
          el.getAttribute("id"),
          el.getAttribute("autocomplete"),
          el.getAttribute("aria-label"),
          el.getAttribute("placeholder"),
        ].filter(Boolean).join(" ");
        return /email|mail|phone|first.?name|last.?name|full.?name|resume|cv|linkedin/i.test(haystack);
      }).length;
      const metadata = [
        candidate.getAttribute("action"),
        candidate.getAttribute("id"),
        candidate.getAttribute("class"),
        candidate.getAttribute("data-testid"),
        candidate.getAttribute("aria-label"),
      ].filter(Boolean).join(" ");

      const score =
        fileInputs * 200 +
        identityInputs * 25 +
        usefulInputs * 5 +
        (/apply|application|candidate|job/i.test(metadata) ? 80 : 0) -
        (usefulInputs <= 1 ? 50 : 0);

      return { candidate, index, score, usable: fileInputs > 0 || usefulInputs >= 2 };
    });

    const usable = scored.filter((entry) => entry.usable);
    usable.sort((a, b) => b.score - a.score || a.index - b.index);
    const best = usable[0]?.candidate;
    if (!best) return null;
    best.setAttribute("data-aplica-application-form", "true");
    return '[data-aplica-application-form="true"]';
  }, selector);
}

async function readFields(page: Page, formSelector: string, applicationUrl: string): Promise<InspectedField[]> {
  const raw = await page.evaluate((selector) => {
    const form = document.querySelector(selector);
    if (!form) return [];
    // Native form.elements also includes inputs associated with form="..."
    // outside the form subtree, a common pattern for hidden upload widgets.
    const nativeControls = Array.from(form instanceof HTMLFormElement ? form.elements : form.querySelectorAll("input, textarea, select"));
    const controls = Array.from(new Set([...nativeControls, ...Array.from(form.querySelectorAll('[role="combobox"]'))]))
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches('input, textarea, select, [role="combobox"]'))
      .filter((el) => !el.parentElement?.closest('[role="combobox"]'));

    const seenRadioNames = new Set<string>();

    for (const el of controls) el.removeAttribute("data-aplica-field");

    return controls
      .filter((el) => !el.matches(':disabled, [aria-disabled="true"]') && !(el instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(el.type)))
      // React Select adds an invisible required-input proxy. Its visible ARIA
      // combobox owns the answer; filling the proxy would invent a second field.
      .filter((el) => !(el.matches('input[aria-hidden="true"][tabindex="-1"]') && el.parentElement?.querySelector('[role="combobox"]')))
      .map((el, index) => {
        const id = el.getAttribute("id");
        const name = el.getAttribute("name") ?? "";
        const tag = el.tagName.toLowerCase();
        const inputType = el.getAttribute("role") === "combobox" ? "combobox" : el instanceof HTMLInputElement ? el.type : tag === "textarea" ? "textarea" : tag === "select" ? "select" : "unknown";

        if (inputType === "radio") {
          if (seenRadioNames.has(name)) return null;
          seenRadioNames.add(name);
        }

        let label = "";
        if (inputType === "radio") label = el.closest("fieldset")?.querySelector("legend")?.textContent?.trim() ?? "";
        if (!label && id) label = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() ?? "";
        if (!label) label = el.closest("label")?.textContent?.trim() ?? "";
        if (!label) label = (el.getAttribute("aria-labelledby") ?? "").split(/\s+/)
          .map((labelId) => document.getElementById(labelId)?.textContent?.trim() ?? "").join(" ").trim();
        if (!label) label = el.getAttribute("aria-label") ?? "";
        const uploadGroup = inputType === "file" ? el.closest('[role="group"][aria-labelledby], fieldset') : null;
        if (uploadGroup && uploadGroup.querySelectorAll('input[type="file"]').length === 1) {
          // Greenhouse labels the file button "Attach" and puts Resume/CV on
          // the owning group, several wrappers above the actual native input.
          const groupLabel = (uploadGroup.getAttribute("aria-labelledby") ?? "").split(/\s+/)
            .map((labelId) => document.getElementById(labelId)?.textContent?.trim() ?? "").join(" ").trim()
            || uploadGroup.querySelector("legend")?.textContent?.trim();
          if (groupLabel) label = groupLabel;
        }
        if (!label && inputType === "file") {
          // Unnamed/hidden native inputs remain uploadable with setInputFiles.
          // Only use a local widget's label, never infer "resume" from all page text.
          let widget = el.parentElement;
          for (let depth = 0; widget && widget !== form && depth < 3; depth++, widget = widget.parentElement) {
            if (widget.querySelectorAll('input[type="file"]').length > 1) break;
            label = widget.querySelector("label,legend")?.textContent?.trim() ?? "";
            if (!label && /resume|\bcv\b|curr[ií]culum|cover\s*letter/i.test(widget.textContent ?? "")) {
              label = widget.textContent?.trim().slice(0, 300) ?? "";
            }
            if (label) break;
          }
        }
        if (!label) label = el.closest("div,fieldset")?.querySelector("label,legend")?.textContent?.trim() ?? "";
        if (!label) label = el.getAttribute("placeholder") || name || id || el.getAttribute("data-testid") || "";

        const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || uploadGroup?.getAttribute("aria-required") === "true" || /\*/.test(label);

        const options =
          el instanceof HTMLSelectElement
            ? Array.from(el.options).map((option) => ({ label: option.textContent?.trim() ?? "", value: option.value }))
            : inputType === "radio" && name
              ? Array.from(form.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`)).map((radio) => {
                  const input = radio as HTMLInputElement;
                  const radioId = input.getAttribute("id");
                  const radioLabel = radioId ? document.querySelector(`label[for="${CSS.escape(radioId)}"]`)?.textContent?.trim() : input.closest("label")?.textContent?.trim();
                  return { label: radioLabel ?? input.value, value: input.value };
                })
              : undefined;

        const fieldId = String(index);
        el.setAttribute("data-aplica-field", fieldId);
        if (inputType === "radio" && name) {
          for (const radio of controls) {
            if (radio instanceof HTMLInputElement && radio.type === "radio" && radio.name === name) {
              radio.setAttribute("data-aplica-field", fieldId);
            }
          }
        }
        return { selector: `[data-aplica-field="${fieldId}"]`, label: label.replace(/\s+/g, " ").trim(), type: inputType, required, options };
      })
      .filter((field): field is NonNullable<typeof field> => Boolean(field && field.selector));
  }, formSelector);

  const fields: InspectedField[] = raw.map((field) => {
    const type = normalizeType(field.type);
    return {
      selector: field.selector,
      label: field.label,
      answerKey: answerKeyFor(field.label, applicationUrl),
      type,
      required: field.required,
      ...(field.options ? { options: field.options } : {}),
      canonicalKey: canonicalKeyFor(field.label),
      demographic: isDemographicQuestion(field.label),
    } satisfies InspectedField;
  });
  for (const field of fields) {
    if (field.type !== "combobox") continue;
    const control = page.locator(field.selector).first();
    try {
      await control.click({ timeout: 3000 });
      const list = await comboboxList(page, field.selector);
      if (list) {
        await list.getByRole("option").first().waitFor({ state: "visible", timeout: 2000 }).catch(() => undefined);
        field.options = await list.getByRole("option").evaluateAll((elements) => elements
          .filter((el) => el.getAttribute("aria-disabled") !== "true")
          .map((el) => ({ label: el.textContent?.trim() ?? "", value: el.textContent?.trim() ?? "" }))
          .filter((option) => Boolean(option.label)));
      }
    } finally {
      await control.press("Escape").catch(() => undefined);
    }
  }
  return fields;
}

// ARIA widgets may render their listbox in a portal outside the form.
async function comboboxList(page: Page, selector: string) {
  const control = page.locator(selector).first();
  const ownedId = (await control.getAttribute("aria-controls")) || (await control.getAttribute("aria-owns"));
  if (ownedId) {
    const owned = page.locator(`[id=${JSON.stringify(ownedId.split(/\s+/)[0])}]`);
    await owned.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
    if (await owned.isVisible()) return owned;
  }
  const visible = page.getByRole("listbox");
  await visible.first().waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
  return await visible.count() === 1 ? visible : null;
}

async function selectComboboxOption(page: Page, field: InspectedField, value: string) {
  const control = page.locator(field.selector).first();
  const label = field.options?.find((option) => option.value === value)?.label ?? value;
  await control.click();
  const editable = await control.evaluate((el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable);
  if (editable) await control.fill(label);
  const list = await comboboxList(page, field.selector);
  if (!list) throw new ApplicationError("FORM_CHANGED", `No unique option list for ${field.label}`);
  const option = list.getByRole("option", { name: label, exact: true });
  await option.first().waitFor({ state: "visible", timeout: 5000 });
  if (await option.count() !== 1) throw new ApplicationError("FORM_CHANGED", `Ambiguous option for ${field.label}`);
  await option.click();
}

function normalizeType(type: string): FieldType {
  if (["text", "email", "tel", "textarea", "select", "combobox", "radio", "checkbox", "file"].includes(type)) return type as FieldType;
  if (type === "url" || type === "search") return "text";
  if (type === "number") return "text";
  return "unknown";
}

export { findDeclineOption };
