import { describe, expect, test } from "bun:test";
import { parseCvText } from "./cv-parse";

describe("parseCvText identity safety", () => {
  test("does not treat Work Experience as a person's name", () => {
    const result = parseCvText(`
WORK EXPERIENCE
Growth Manager
Acme
2025 - Present
fausto@agrodeo.farm
Buenos Aires, Argentina
`);

    expect(result.fields.firstName).toBe("Fausto");
    expect(result.fields.lastName).toBeUndefined();
    expect(
      `${result.fields.firstName ?? ""} ${result.fields.lastName ?? ""}`.trim(),
    ).not.toBe("Work Experience");
  });

  test("prefers a real name over a resume section heading", () => {
    const result = parseCvText(`
WORK EXPERIENCE
Fausto Sicilia
fausto@agrodeo.farm
+54 11 3065 9123
Buenos Aires, Argentina
Growth Manager
Acme
2025 - Present
`);

    expect(result.fields.firstName).toBe("Fausto");
    expect(result.fields.lastName).toBe("Sicilia");
  });

  test("rejects other common CV headings as names", () => {
    for (const heading of [
      "Professional Experience",
      "Employment History",
      "Education",
      "Technical Skills",
      "Career Profile",
    ]) {
      const result = parseCvText(`
${heading}
fausto.sicilia@example.com
Buenos Aires, Argentina
`);
      expect(
        `${result.fields.firstName ?? ""} ${result.fields.lastName ?? ""}`.trim(),
      ).not.toBe(heading);
    }
  });
});
