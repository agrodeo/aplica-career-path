import { useEffect, useRef } from "react";

const opportunities = [
  { role: "Growth Manager", place: "Remoto", match: "94% match", x: "10%", y: "9%", depth: "near" },
  { role: "Product Growth", place: "Buenos Aires", match: "91% match", x: "40%", y: "2%", depth: "near" },
  { role: "Marketing Associate", place: "Remoto", match: "89% match", x: "70%", y: "11%", depth: "near" },
  { role: "Business Analyst", place: "Híbrido", match: "86% match", x: "2%", y: "38%", depth: "middle" },
  { role: "Product Manager", place: "Ciudad de México", match: "84% match", x: "25%", y: "42%", depth: "middle" },
  { role: "Lifecycle Marketing", place: "Remoto", match: "82% match", x: "55%", y: "35%", depth: "middle" },
  { role: "Strategy Associate", place: "Santiago", match: "80% match", x: "79%", y: "43%", depth: "middle" },
  { role: "Operations Lead", place: "Bogotá", match: "78% match", x: "15%", y: "69%", depth: "far" },
  { role: "Data Analyst", place: "Remoto", match: "76% match", x: "43%", y: "72%", depth: "far" },
  { role: "Account Executive", place: "Lima", match: "74% match", x: "68%", y: "67%", depth: "far" },
  { role: "Brand Strategist", place: "Híbrido", match: "72% match", x: "88%", y: "75%", depth: "far" },
];

export function OpportunityField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const move = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      field.style.setProperty("--field-x", `${x * 4}px`);
      field.style.setProperty("--field-y", `${y * 3}px`);
    };
    const reset = () => {
      field.style.setProperty("--field-x", "0px");
      field.style.setProperty("--field-y", "0px");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <div ref={fieldRef} className="opportunity-field" aria-hidden="true">
      <div className="opportunity-horizon" />
      <div className="opportunity-traces" />
      {opportunities.map((opportunity) => (
        <div
          key={`${opportunity.role}-${opportunity.x}`}
          className={`opportunity-fragment opportunity-fragment-${opportunity.depth}`}
          style={{ left: opportunity.x, top: opportunity.y }}
        >
          <div className="opportunity-role">{opportunity.role}</div>
          <div className="opportunity-meta"><span>{opportunity.place}</span><span>{opportunity.match}</span></div>
        </div>
      ))}
      <div className="opportunity-fade" />
    </div>
  );
}