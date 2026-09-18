import { useEffect, useRef } from "react";

const wisps = Array.from({ length: 8 }, (_, index) => index);

export function OpportunityField() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2;
        const y = (event.clientY / window.innerHeight - 0.5) * 2;
        field.style.setProperty("--atmosphere-x", x.toFixed(3));
        field.style.setProperty("--atmosphere-y", y.toFixed(3));
      });
    };

    const reset = () => {
      field.style.setProperty("--atmosphere-x", "0");
      field.style.setProperty("--atmosphere-y", "0");
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
    <div ref={fieldRef} className="opportunity-atmosphere" aria-hidden="true">
      <div className="atmosphere-focus" />

      <div className="atmosphere-depth atmosphere-depth-far">
        {wisps.map((wisp) => (
          <span key={wisp} className={`atmosphere-wisp atmosphere-wisp-${wisp + 1}`}>
            <i /><i /><i />
          </span>
        ))}
        <span className="atmosphere-word atmosphere-word-growth">Growth</span>
      </div>

      <div className="atmosphere-depth atmosphere-depth-mid">
        <span className="atmosphere-thread atmosphere-thread-1" />
        <span className="atmosphere-thread atmosphere-thread-2" />
        <span className="atmosphere-thread atmosphere-thread-3" />
        <span className="atmosphere-word atmosphere-word-product">Product</span>
        <span className="atmosphere-word atmosphere-word-remote">Remote</span>
      </div>

      <div className="atmosphere-depth atmosphere-depth-near">
        <span className="atmosphere-word atmosphere-word-score">94%</span>
        <span className="atmosphere-word atmosphere-word-marketing">Marketing</span>
      </div>
    </div>
  );
}