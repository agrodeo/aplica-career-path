import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
};

type Edge = {
  start: number;
  end: number;
};

function distanceToSegment(mouse: Point, start: Point, end: Point) {
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
    let edges: Edge[] = [];
    let mouse = { x: -1000, y: -1000 };
    let pointerActive = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const spacing = width < 640 ? 108 : 132;
      const columns = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;
      let seed = 9473;
      const random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      points = [];
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          points.push({
            x: column * spacing + (row % 2) * spacing * 0.46 - spacing * 0.35 + (random() - 0.5) * 42,
            y: row * spacing - spacing * 0.25 + (random() - 0.5) * 42,
          });
        }
      }

      edges = [];
      points.forEach((point, index) => {
        const nearest = points
          .map((candidate, candidateIndex) => ({
            index: candidateIndex,
            distance: Math.hypot(point.x - candidate.x, point.y - candidate.y),
          }))
          .filter((candidate) => candidate.index !== index && candidate.distance < spacing * 1.35)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);

        nearest.forEach(({ index: otherIndex }) => {
          const start = Math.min(index, otherIndex);
          const end = Math.max(index, otherIndex);
          if (!edges.some((edge) => edge.start === start && edge.end === end)) edges.push({ start, end });
        });
      });
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      const styles = getComputedStyle(canvas);
      const lineColor = styles.getPropertyValue("--network-line").trim();
      const activeLineColor = styles.getPropertyValue("--network-line-active").trim();
      const nodeColor = styles.getPropertyValue("--network-node").trim();
      const activeNodeColor = styles.getPropertyValue("--network-node-active").trim();
      const glowColor = styles.getPropertyValue("--network-glow").trim();

      edges.forEach((edge, edgeIndex) => {
        const point = points[edge.start];
        const other = points[edge.end];
        if (!point || !other) return;
        const active = pointerActive ? Math.max(0, 1 - distanceToSegment(mouse, point, other) / 145) : 0;

        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.strokeStyle = active > 0.04 ? activeLineColor : lineColor;
        context.globalAlpha = active > 0.04 ? 0.55 + active * 0.45 : 1;
        context.lineWidth = active > 0.04 ? 1.1 + active * 0.65 : 0.9;
        context.stroke();
        context.globalAlpha = 1;

        if (active > 0.08) {
          const phase = reduceMotion ? 0.5 : (time / 1200 + edgeIndex * 0.137) % 1;
          const pulseX = point.x + (other.x - point.x) * phase;
          const pulseY = point.y + (other.y - point.y) * phase;
          const glow = context.createRadialGradient(pulseX, pulseY, 0, pulseX, pulseY, 18);
          glow.addColorStop(0, glowColor);
          glow.addColorStop(1, "transparent");
          context.globalAlpha = active;
          context.fillStyle = glow;
          context.beginPath();
          context.arc(pulseX, pulseY, 18, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 1;
        }
      });

      points.forEach((point) => {
        const proximity = pointerActive ? Math.max(0, 1 - Math.hypot(point.x - mouse.x, point.y - mouse.y) / 175) : 0;
        if (proximity > 0.08) {
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 25);
          glow.addColorStop(0, glowColor);
          glow.addColorStop(1, "transparent");
          context.globalAlpha = proximity;
          context.fillStyle = glow;
          context.beginPath();
          context.arc(point.x, point.y, 25, 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 1;
        }
        context.fillStyle = proximity > 0.08 ? activeNodeColor : nodeColor;
        context.beginPath();
        context.arc(point.x, point.y, proximity > 0.08 ? 2.7 : 2.1, 0, Math.PI * 2);
        context.fill();
      });
      frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      mouse = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      pointerActive = mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height;
    };
    const onPointerLeave = () => {
      pointerActive = false;
      mouse = { x: -1000, y: -1000 };
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}