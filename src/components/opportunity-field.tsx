import { useEffect, useRef, type CSSProperties } from "react";

type Opportunity = {
  role: string;
  match: string;
  className: string;
  depth: "far" | "mid" | "front";
};

const opportunities: Opportunity[] = [
  { role: "Growth Manager", match: "94% match", className: "map-label-growth", depth: "front" },
  { role: "Product Growth", match: "91% match", className: "map-label-product-growth", depth: "mid" },
  { role: "Growth Analyst", match: "89% match", className: "map-label-analyst", depth: "front" },
  { role: "Marketing Lead", match: "87% match", className: "map-label-marketing", depth: "mid" },
  { role: "Business Analyst", match: "84% match", className: "map-label-business", depth: "far" },
  { role: "Product Manager", match: "82% match", className: "map-label-product", depth: "front" },
];

const nodes = [
  [100, 406, "far"], [214, 322, "mid"], [318, 438, "far"], [410, 257, "mid"],
  [520, 346, "front"], [612, 188, "mid"], [708, 286, "front"], [786, 430, "far"],
  [890, 220, "front"], [970, 352, "mid"], [1070, 282, "front"], [1168, 426, "far"],
  [1250, 248, "mid"], [1360, 380, "front"], [458, 548, "mid"], [1008, 542, "mid"],
] as const;

export function OpportunityField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        field.style.setProperty("--map-x", x.toFixed(3));
        field.style.setProperty("--map-y", y.toFixed(3));
      });
    };
    const reset = () => {
      field.style.setProperty("--map-x", "0");
      field.style.setProperty("--map-y", "0");
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <div ref={fieldRef} className="opportunity-map" aria-hidden="true">
      <div className="map-layer map-layer-far">
        <svg className="map-canvas" viewBox="0 0 1440 720" preserveAspectRatio="none">
          <path className="map-path map-path-far" pathLength="1" d="M-90 220 C170 120 310 430 565 390 S980 160 1530 260" />
          <path className="map-path map-path-far" pathLength="1" d="M-70 520 C260 320 430 610 755 514 S1180 250 1510 470" />
          <circle className="map-node map-node-far" cx="100" cy="406" r="4" />
          <circle className="map-node map-node-far" cx="318" cy="438" r="4" />
          <circle className="map-node map-node-far" cx="786" cy="430" r="4" />
          <circle className="map-node map-node-far" cx="1168" cy="426" r="4" />
        </svg>
      </div>

      <div className="map-layer map-layer-mid">
        <svg className="map-canvas" viewBox="0 0 1440 720" preserveAspectRatio="none">
          <path className="map-path map-path-mid" pathLength="1" d="M-70 350 C175 405 245 170 480 252 C660 315 700 510 930 432 C1130 363 1215 118 1510 180" />
          <path className="map-path map-path-mid" pathLength="1" d="M240 760 C260 540 470 520 612 188 C692 6 872 150 970 352 C1065 548 1270 570 1510 410" />
          <path className="map-path map-path-mid" pathLength="1" d="M-80 630 C190 590 315 236 535 350 C750 462 954 686 1190 526 C1300 452 1400 330 1510 318" />
          {nodes.filter(([, , depth]) => depth === "mid").map(([cx, cy], index) => (
            <circle key={`${cx}-${cy}`} className="map-node map-node-mid" style={{ "--node-delay": `${420 + index * 70}ms` } as CSSProperties} cx={cx} cy={cy} r="5" />
          ))}
        </svg>
      </div>

      <div className="map-layer map-layer-front">
        <svg className="map-canvas" viewBox="0 0 1440 720" preserveAspectRatio="none">
          <path className="map-path map-path-primary" pathLength="1" d="M720 -25 C706 92 622 146 708 286 C765 379 884 362 890 220 C896 92 1075 86 1070 282 C1066 420 1225 487 1450 392" />
          <path className="map-path map-path-front" pathLength="1" d="M708 286 C608 346 535 276 520 346 C491 478 633 574 825 552 C1008 531 1168 650 1455 604" />
          {nodes.filter(([, , depth]) => depth === "front").map(([cx, cy], index) => (
            <g key={`${cx}-${cy}`} className="map-node-group" style={{ "--node-delay": `${500 + index * 90}ms` } as CSSProperties}>
              <circle className="map-node-halo" cx={cx} cy={cy} r="14" />
              <circle className="map-node map-node-front" cx={cx} cy={cy} r="6" />
            </g>
          ))}
        </svg>
      </div>

      {opportunities.map((opportunity, index) => (
        <div
          key={opportunity.role}
          className={`map-label map-label-${opportunity.depth} ${opportunity.className}`}
          style={{ "--label-delay": `${700 + index * 80}ms` } as CSSProperties}
        >
          <span className="map-label-role">{opportunity.role}</span>
          <span className="map-label-match">{opportunity.match}</span>
        </div>
      ))}
    </div>
  );
}