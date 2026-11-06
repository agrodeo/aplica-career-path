const normalized = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

/** Exact option matching; location widgets may insert a state between city and country. */
export function matchComboboxOption(options: { label: string; value: string }[], requested: string, key: string | null) {
  const value = normalized(requested);
  const exact = options.filter(option => normalized(option.value) === value || normalized(option.label) === value);
  if (exact.length) return exact.length === 1 ? exact[0]! : null;
  if (key !== 'location') return null;
  const desired = requested.split(',').map(normalized).filter(Boolean);
  if (desired.length < 2) return null;
  const matches = options.filter(option => {
    const parts = option.label.split(',').map(normalized).filter(Boolean);
    return parts[0] === desired[0] && parts.at(-1) === desired.at(-1) && desired.every(part => parts.includes(part));
  });
  return matches.length === 1 ? matches[0]! : null;
}
