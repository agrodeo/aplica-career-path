/** Multiple answers share the existing text storage format as an explicit JSON list. */
export function multipleChoiceValues(value: unknown, options: { value?: string }[], required = false): string[] | null {
  if (typeof value !== "string") return null;
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(parsed) || !parsed.every(item => typeof item === "string" && options.some(option => option.value === item))) return null;
  if (new Set(parsed).size !== parsed.length || (required && !parsed.length)) return null;
  return parsed as string[];
}
