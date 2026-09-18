import { Check, FileText, Search } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import meliLogo from "@/assets/mercado-libre.png.asset.json";
import rampLogo from "@/assets/ramp.png.asset.json";
import canvaLogo from "@/assets/canva.png.asset.json";

const phaseDurations = [1800, 1800, 2200, 2400, 2100, 2400, 2000];
const exitDuration = 420;
const profileSignals = ["Growth", "Marketing", "Buenos Aires", "Inglés", "Español", "Remoto"];
const demoJobs = [
  { role: "Growth Manager", company: "Mercado Libre", logo: meliLogo.url, match: "94% match" },
  { role: "Growth Associate", company: "Ramp", logo: rampLogo.url, match: "91% match" },
  { role: "Marketing Manager", company: "Canva", logo: canvaLogo.url, match: "88% match" },
];

function SearchCounter({ duration }: { duration: number }) {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const run = (now: number) => {
      const t = Math.min((now - start) / (duration - 320), 1);
      const eased = 1 - Math.pow(1 - t, 2.4);
      setValue(Math.round(eased * 127));
      if (t < 1) frame.current = requestAnimationFrame(run);
    };
    frame.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame.current);
  }, [duration]);

  return <strong className="demo-counter">{value}</strong>;
}

function DemoProgress({ phase }: { phase: number }) {
  return (
    <div className="demo-progress" aria-hidden="true">
      {phaseDurations.map((duration, index) => (
        <span
          className={index === phase ? "is-active" : index < phase ? "is-complete" : ""}
          key={index}
          style={{ "--demo-phase-duration": `${duration}ms` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function phaseContent(phase: number): ReactNode {
  if (phase === 0)
    return (
      <>
        <div className="demo-heading"><span className="demo-eyebrow">Empezá con tu perfil</span><h2>Subí tu CV</h2></div>
        <div className="demo-upload">
          <div className="demo-upload-icon"><FileText /></div>
          <div className="demo-file"><FileText /><span><strong>CV_Fausto.pdf</strong><small>PDF · 248 KB</small></span></div>
          <p>Arrastrá tu CV acá</p>
        </div>
        <p className="demo-confirm demo-delay-late"><Check /> CV cargado</p>
      </>
    );

  if (phase === 1)
    return (
      <>
        <div className="demo-heading"><span className="demo-eyebrow">Tu experiencia</span><h2>Analizando tu perfil...</h2></div>
        <div className="demo-signals">
          {profileSignals.map((signal, index) => <span style={{ "--demo-order": index } as CSSProperties} key={signal}>{signal}</span>)}
        </div>
        <p className="demo-confirm demo-delay-late"><Check /> Perfil listo</p>
      </>
    );

  if (phase === 2)
    return (
      <>
        <div className="demo-search-icon"><Search /></div>
        <div className="demo-centered">
          <h2>Buscando trabajos para vos...</h2>
          <SearchCounter duration={phaseDurations[2] ?? 2200} />
          <p>oportunidades encontradas</p>
        </div>
      </>
    );

  if (phase === 3)
    return (
      <>
        <div className="demo-heading"><span className="demo-eyebrow">Mejores resultados</span><h2>Trabajos que encajan con vos</h2></div>
        <div className="demo-jobs">
          {demoJobs.map(([role, match], index) => <div className="demo-job" style={{ "--demo-order": index } as CSSProperties} key={role}><span><strong>{role}</strong><small>Buenos Aires · Remoto</small></span><b>{match}</b></div>)}
        </div>
      </>
    );

  if (phase === 4)
    return (
      <>
        <div className="demo-heading"><span className="demo-eyebrow">Growth Manager · 94% match</span><h2>Adaptando tu CV...</h2></div>
        <div className="demo-resume-lines" aria-hidden="true"><span /><span /><span /></div>
        <div className="demo-checklist">
          {["Experiencia relevante priorizada", "Skills alineadas", "CV listo"].map((label, index) => <p style={{ "--demo-order": index } as CSSProperties} key={label}><Check />{label}</p>)}
        </div>
      </>
    );

  if (phase === 5)
    return (
      <>
        <div className="demo-heading"><span className="demo-eyebrow">Cola de postulaciones</span><h2>Aplicando por vos</h2></div>
        <div className="demo-queue">
          <div className="demo-queue-row is-done"><span><strong>Growth Manager</strong><small>CV adaptado</small></span><b><Check /> Aplicado</b></div>
          <div className="demo-queue-row is-done demo-queue-second"><span><strong>Growth Associate</strong><small>CV adaptado</small></span><b><Check /> Aplicado</b></div>
          <div className="demo-queue-row is-applying"><span><strong>Marketing Manager</strong><small>Preparando postulación</small></span><b>Aplicando...</b></div>
        </div>
      </>
    );

  return (
    <div className="demo-final">
      <div className="demo-final-check"><Check /></div>
      <strong>24</strong>
      <h2>aplicaciones enviadas.</h2>
      <p>Mientras vos seguís con tu día.</p>
    </div>
  );
}

export function ProductDemo() {
  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExiting(phase);
      setPhase((current) => (current + 1) % phaseDurations.length);
    }, phaseDurations[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (exiting === null) return;
    const timer = window.setTimeout(() => setExiting(null), exitDuration);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  return (
    <div className="product-demo" aria-label="Demostración automática del proceso de Aplica" aria-live="off">
      {exiting !== null && exiting !== phase && (
        <div className="product-demo-frame is-exiting" key={`exit-${exiting}`} aria-hidden="true">
          <DemoProgress phase={exiting} />
          {phaseContent(exiting)}
        </div>
      )}
      <div className="product-demo-frame" key={phase}>
        <DemoProgress phase={phase} />
        {phaseContent(phase)}
      </div>
    </div>
  );
}
