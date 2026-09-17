import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export function HeroNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let points: Point[] = [];
    let mouse = { x: -1000, y: -1000 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(24, Math.min(58, Math.round(width / 25)));
      points = Array.from({ length: count }, (_, index) => ({
        x: ((index * 73) % 100) / 100 * width,
        y: ((index * 47 + 19) % 100) / 100 * height,
        vx: ((index % 5) - 2) * 0.045,
        vy: (((index * 3) % 5) - 2) * 0.035,
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        if (!reduceMotion) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < -10 || point.x > width + 10) point.vx *= -1;
          if (point.y < -10 || point.y > height + 10) point.vy *= -1;
        }

        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 150) {
            const mouseDistance = Math.min(
              Math.hypot(point.x - mouse.x, point.y - mouse.y),
              Math.hypot(other.x - mouse.x, other.y - mouse.y),
            );
            const active = Math.max(0, 1 - mouseDistance / 190);
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `oklch(0.58 0.19 154 / ${0.07 + active * 0.3})`;
            context.lineWidth = 0.7 + active * 0.7;
            context.stroke();
          }
        }

        const proximity = Math.max(0, 1 - Math.hypot(point.x - mouse.x, point.y - mouse.y) / 190);
        if (proximity > 0) {
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 22 + proximity * 16);
          glow.addColorStop(0, `oklch(0.72 0.2 150 / ${proximity * 0.45})`);
          glow.addColorStop(1, "oklch(0.72 0.2 150 / 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(point.x, point.y, 22 + proximity * 16, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = `oklch(0.56 0.19 154 / ${0.22 + proximity * 0.78})`;
        context.beginPath();
        context.arc(point.x, point.y, 1.5 + proximity * 2.2, 0, Math.PI * 2);
        context.fill();
      }
      frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      mouse = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const onPointerLeave = () => { mouse = { x: -1000, y: -1000 }; };

    resize();
    draw();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}