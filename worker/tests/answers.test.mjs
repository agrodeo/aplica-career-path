import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareAnswers, generatedInterest, validateGeneratedAnswer } from "../dist/application/answers.js";
import { makesJobUnsupported } from "../dist/utils/errors.js";
import { profile, job } from "./fixtures.mjs";

const country = { selector: "#country", label: "Country", answerKey: "country", canonicalKey: "country", type: "select", required: true, options: [{ label: "Chile", value: "CL" }] };
test("a profile answer absent from the offered options does not disable the job", () => {
  assert.throws(() => prepareAnswers({ fields: [country] }, profile, job), (error) => error.code === "PROFILE_INCOMPLETE" && !makesJobUnsupported(error.code));
});
test("an explicit option answer can complete a previously missing question", () => {
  const answered = { ...profile, verifiedApplicationAnswers: [{ canonicalKey: "country", answerType: "text", textValue: "CL", booleanValue: null, numericValue: null, userConfirmed: true }] };
  assert.equal(prepareAnswers({ fields: [country] }, answered, job)[0].value, "CL");
});
test("sensitive answers are never inferred and unconfirmed answers are ignored", () => {
  const field = { ...country, canonicalKey: "sponsorship", answerKey: "sponsorship", options: [{ label: "Yes", value: "Y" }, { label: "No", value: "N" }] };
  assert.throws(() => prepareAnswers({ fields: [field] }, profile, job), { code: "PROFILE_INCOMPLETE" });
  const answered = { ...profile, verifiedApplicationAnswers: [{ canonicalKey: "sponsorship", answerType: "boolean", booleanValue: false, textValue: null, numericValue: null, userConfirmed: true }] };
  assert.equal(prepareAnswers({ fields: [field] }, answered, job)[0].value, "N");
});
test("required consent needs the user's explicit true answer", () => {
  const field = { ...country, type: "checkbox", canonicalKey: null, answerKey: "consent", options: undefined };
  assert.throws(() => prepareAnswers({ fields: [field] }, profile, job), { code: "PROFILE_INCOMPLETE" });
});
test("CVs are uploaded only to mapped resume fields", () => {
  const field = { ...country, label: "Other CV attachment", type: "file", canonicalKey: null, required: false };
  assert.deepEqual(prepareAnswers({ fields: [field] }, profile, job), []);
});
test("past employment is not described as current", () => {
  const experienced = { ...profile, experience: [{ id: "previous", title: "Engineer", company: "Previous", isCurrent: false, startDate: null, endDate: null, description: "", achievements: [] }] };
  assert.match(generatedInterest(experienced, job), /Trabajé como Engineer en Previous/);
  assert.doesNotMatch(generatedInterest(experienced, job), /Actualmente/);
  assert.equal(validateGeneratedAnswer(generatedInterest(experienced, job), experienced, job).valid, true);
  assert.equal(validateGeneratedAnswer("Me interesa. Trabajé en InventedCompany ganando 999999.", experienced, job).valid, false);
});
