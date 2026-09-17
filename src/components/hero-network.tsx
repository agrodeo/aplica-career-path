import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
};

function distanceToSegment(mouse: { x: number; y: number }, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(mouse.x - start.x, mouse.y - start.y);
  const position = Math.max(0, Math.min(1, ((mouse.x - start.x) * dx + (mouse.y - start.y) * dy) / lengthSquared));
  return Math.hypot(mouse.x - (start.x + position * dx), mouse.y - (start.y + position * dy));
}

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
      const count = Math.max(36, Math.min(76, Math.round((width * height) / 15000)));
      let seed = 9473;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      points = Array.from({ length: count }, (_, index) => ({
        x: index < 4 ? [0.03, 0.97, 0.08, 0.92][index] * width : random() * width,
        y: index < 4 ? [0.12, 0.2, 0.88, 0.82][index] * height : random() * height,
      }));
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        if (!point) continue;

        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          if (!other) continue;
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 185) {
            const cursorDistance = distanceToSegment(mouse, point, other);
            const active = Math.max(0, 1 - cursorDistance / 105);
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `oklch(0.52 0.17 154 / ${0.16 + active * 0.24})`;
            context.lineWidth = 0.8 + active * 0.5;
            context.stroke();

            if (active > 0.04) {
              const phase = reduceMotion ? 0.5 : ((time / 1050 + i * 0.17 + j * 0.11) % 1);
              const pulseX = point.x + (other.x - point.x) * phase;
              const pulseY = point.y + (other.y - point.y) * phase;
              const pulse = context.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 15 + active * 12);
              pulse.addColorStop(0, `oklch(0.78 0.22 147 / ${0.9 * active})`);
              pulse.addColorStop(0.22, `oklch(0.68 0.2 151 / ${0.6 * active})`);
              pulse.addColorStop(1, "oklch(0.68 0.2 151 / 0)");
              context.fillStyle = pulse;
              context.beginPath();
              context.arc(pulseX, pulseY, 15 + active * 12, 0, Math.PI * 2);
              context.fill();
              context.fillStyle = `oklch(0.78 0.22 147 / ${active})`;
              context.beginPath();
              context.arc(pulseX, pulseY, 2.1, 0, Math.PI * 2);
              context.fill();
            }
          }
        }

        const proximity = Math.max(0, 1 - Math.hypot(point.x - mouse.x, point.y - mouse.y) / 150);
        if (proximity > 0) {
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 22 + proximity * 16);
          glow.addColorStop(0, `oklch(0.72 0.2 150 / ${proximity * 0.45})`);
          glow.addColorStop(1, "oklch(0.72 0.2 150 / 0)");
          context.fillStyle = glow;
          context.beginPath();
          context.arc(point.x, point.y, 22 + proximity * 16, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = `oklch(0.5 0.18 154 / ${0.5 + proximity * 0.5})`;
        context.beginPath();
        context.arc(point.x, point.y, 2 + proximity * 2.2, 0, Math.PI * 2);
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