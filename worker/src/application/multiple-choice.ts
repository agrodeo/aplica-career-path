/** Parse only an explicitly confirmed JSON list. Never infer skills or consents. */
export function resolveMultipleChoices(value: string | boolean | null, options: { label: string; value: string }[], required: boolean): string[] | null {
  if (typeof value !== "string") return null;
  let choices: unknown;
  try { choices = JSON.parse(value); } catch { return null; }
  if (!Array.isArray(choices) || !choices.every(choice => typeof choice === "string") || new Set(choices).size !== choices.length) return null;
  const resolved: string[] = [];
  for (const choice of choices as string[]) {
    const exact = options.filter(option => option.value === choice);
    const matches = exact.length ? exact : options.filter(option => option.label.trim().toLowerCase() === choice.trim().toLowerCase());
    if (matches.length !== 1) return null;
    resolved.push(matches[0]!.value);
  }
  if ((required && !resolved.length) || new Set(resolved).size !== resolved.length) return null;
  return resolved;
}
