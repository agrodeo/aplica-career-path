import type { Page } from "playwright";
import { canonicalKeyFor, findDeclineOption, isDemographicQuestion } from "./field-map.js";
import { SENSITIVE_KEYS, type ApplicationAdapter, type ApplicationSchema, type EligibilityResult, type FieldType, type InspectedField, type MasterProfile, type SubmissionContext, type SubmissionResult, type VerificationResult } from "./types.js";
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

      const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? "";
      const captchaDetected = await detectCaptcha(page);
      const loginRequired = LOGIN_SIGNALS.some((pattern) => pattern.test(bodyText));

      const form = page.locator(options.formSelector).first();
      const formExists = (await form.count()) > 0;
      const fields = formExists ? await readFields(page, options.formSelector) : [];

      let submitSelector: string | null = null;
      for (const selector of options.submitSelectors) {
        if ((await page.locator(selector).count()) > 0) {
          submitSelector = selector;
          break;
        }
      }

      const requiredFields = fields.filter((f) => f.required).map((f) => f.label);
      const unknownRequiredFields = fields
        .filter(
          (f) =>
            f.required &&
            !f.canonicalKey &&
            !(f.demographic && f.options && findDeclineOption(f.options)),
        )
        .map((f) => f.label);
      const supportsFileUpload = fields.some((f) => f.type === "file");

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

      // Keep global schema blockers separate from user-specific missing data.
      // A user missing sponsorship/phone/etc. must never remove the job from
      // everybody else's inventory.
      const unsupportedFields: string[] = [...schema.unknownRequiredFields];
      const missingProfileAnswers: string[] = [];

      for (const field of schema.fields) {
        if (!field.required) continue;

        if (field.demographic && field.options && findDeclineOption(field.options)) {
          continue;
        }

        // MVP only generates/uploads the resume. Required extra documents are
        // a capability gap of the adapter, not a profile gap.
        if (field.type === "file") {
          if (field.canonicalKey !== "resume") unsupportedFields.push(field.label);
          continue;
        }

        if (!field.canonicalKey) {
          unsupportedFields.push(field.label);
          continue;
        }

        if (!canAnswer(field.canonicalKey, profile)) {
          missingProfileAnswers.push(field.label);
        }
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

      if (missingProfileAnswers.length) {
        return {
          eligible: false,
          failureCode: "PROFILE_INCOMPLETE",
          reasons: [
            `Faltan respuestas verificadas del usuario: ${missingProfileAnswers.join(", ")}`,
          ],
          unknownRequiredFields: missingProfileAnswers,
        };
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
            case "checkbox":
              if (answer.value === true) await locator.check();
              else if (await locator.isChecked().catch(() => false)) await locator.uncheck();
              break;
            case "radio": {
              const value = String(answer.value);
              const radios = page.locator(answer.field.selector);
              const count = await radios.count();
              let selected = false;
              for (let i = 0; i < count; i += 1) {
                const radio = radios.nth(i);
                if ((await radio.getAttribute("value")) === value) {
                  await radio.check();
                  selected = true;
                  break;
                }
              }
              if (!selected) {
                throw new ApplicationError("FORM_CHANGED", `Radio option disappeared: ${answer.field.label}`);
              }
              break;
            }
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

      await page.locator(schema.submitSelector).first().click();
      await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => undefined);
      const pageText = (await page.locator("body").innerText().catch(() => "")) ?? "";
      return { submitted: true, dryRun: false, page, adapter: options.id, adapterVersion: options.version, responseUrl: page.url(), pageText };
    },

    async verify(result: SubmissionResult): Promise<VerificationResult> {
      if (!result.submitted || result.dryRun) return { verified: false, verificationType: "none", verificationValue: null, screenshot: null };

      const text = result.pageText ?? "";
      const identifier = text.match(APPLICATION_ID_PATTERN);
      if (identifier?.[3]) {
        return { verified: true, verificationType: "application_identifier", verificationValue: identifier[3], screenshot: await result.page.screenshot({ fullPage: true }) };
      }
      const success = SUCCESS_PATTERNS.find((pattern) => pattern.test(text));
      if (success) {
        const matched = text.match(success)?.[0] ?? "confirmation";
        return { verified: true, verificationType: "success_message", verificationValue: matched.slice(0, 200), screenshot: await result.page.screenshot({ fullPage: true }) };
      }
      if (/confirmation|thank you|gracias/i.test(result.responseUrl ?? "")) {
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

function canAnswer(key: string, profile: MasterProfile): boolean {
  const stored = profile.verifiedApplicationAnswers.find((a) => a.canonicalKey === key && a.userConfirmed);
  if (SENSITIVE_KEYS.includes(key)) return Boolean(stored); // never inferred
  switch (key) {
    case "first_name":
      return Boolean(profile.identity.firstName);
    case "last_name":
      return Boolean(profile.identity.lastName);
    case "full_name":
      return Boolean(profile.identity.firstName && profile.identity.lastName);
    case "email":
      return Boolean(profile.identity.email);
    case "phone":
      return Boolean(profile.identity.phone);
    case "location":
      return Boolean(profile.identity.city || profile.identity.country);
    case "linkedin":
      return Boolean(profile.links.linkedin);
    case "portfolio":
    case "website":
      return Boolean(profile.links.portfolio);
    case "current_title":
      return Boolean(profile.identity.currentTitle || profile.experience[0]?.title);
    case "current_company":
      return Boolean(profile.experience[0]?.company);
    case "years_experience":
      return profile.experience.length > 0;
    case "resume":
      return true;
    case "cover_letter":
      return Boolean(profile.identity.professionalSummary || profile.experience.length);
    default:
      return Boolean(stored);
  }
}

async function readFields(page: Page, formSelector: string): Promise<InspectedField[]> {
  const raw = await page.evaluate((selector) => {
    const form = document.querySelector(selector);
    if (!form) return [];
    const controls = Array.from(form.querySelectorAll("input, textarea, select")) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[];
    const seenRadioNames = new Set<string>();

    return controls
      .filter((el) => !(el instanceof HTMLInputElement && ["hidden", "submit", "button"].includes(el.type)))
      .map((el) => {
        const id = el.getAttribute("id");
        const name = el.getAttribute("name") ?? "";
        const tag = el.tagName.toLowerCase();
        const inputType = el instanceof HTMLInputElement ? el.type : tag === "textarea" ? "textarea" : "select";

        if (inputType === "radio") {
          if (seenRadioNames.has(name)) return null;
          seenRadioNames.add(name);
        }

        let label = "";
        if (id) label = document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() ?? "";
        if (!label) label = el.closest("label")?.textContent?.trim() ?? "";
        if (!label) label = el.closest("div,fieldset")?.querySelector("label,legend")?.textContent?.trim() ?? "";
        if (!label) label = el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? name;

        const required = el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || /\*/.test(label);

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

        const selector = id
          ? `#${CSS.escape(id)}`
          : name
            ? `${selector0(tag, inputType)}[name="${CSS.escape(name)}"]`
            : "";
        return { selector, label: label.replace(/\s+/g, " ").trim(), type: inputType, required, options };

        function selector0(tagName: string, type: string) {
          if (tagName === "select" || tagName === "textarea") return tagName;
          return `input[type="${type}"]`;
        }
      })
      .filter((field): field is NonNullable<typeof field> => Boolean(field && field.selector));
  }, formSelector);

  return raw.map((field) => {
    const type = normalizeType(field.type);
    return {
      selector: field.selector,
      label: field.label,
      type,
      required: field.required,
      ...(field.options ? { options: field.options } : {}),
      canonicalKey: canonicalKeyFor(field.label),
      demographic: isDemographicQuestion(field.label),
    } satisfies InspectedField;
  });
}

function normalizeType(type: string): FieldType {
  if (["text", "email", "tel", "textarea", "select", "radio", "checkbox", "file"].includes(type)) return type as FieldType;
  if (type === "url" || type === "search") return "text";
  if (type === "number") return "text";
  return "unknown";
}

export { findDeclineOption };
