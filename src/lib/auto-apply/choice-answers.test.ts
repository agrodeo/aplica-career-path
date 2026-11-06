import { expect, test } from "bun:test";
import { multipleChoiceValues } from "./choice-answers";
const options = [{ value: "website" }, { value: "referral" }];
test("multiple choices reject stale, duplicate and malformed answers", () => {
  for (const answer of ['["old-option"]', '["website","website"]', 'true', '[1]', 'website']) expect(multipleChoiceValues(answer, options, true)).toBeNull();
  expect(multipleChoiceValues('["website","referral"]', options, true)).toEqual(["website", "referral"]);
});
test("empty choice lists are valid only for optional questions", () => {
  expect(multipleChoiceValues('[]', options, true)).toBeNull();
  expect(multipleChoiceValues('[]', options)).toEqual([]);
});
