import { Check, FileText, Search } from "lucide-react";
import { useEffect, useState } from "react";

const phaseDurations = [1500, 1500, 1800, 2000, 1700, 2000, 1500];
const profileSignals = ["Growth", "Marketing", "Buenos Aires", "Inglés", "Español", "Remoto"];
const demoJobs = [
  ["Growth Manager", "94% match"],
  ["Growth Associate", "91% match"],
  ["Marketing Manager", "88% match"],
];

function SearchCounter() {
  const values = [12, 34, 67, 96, 127];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => Math.min(current + 1, values.length - 1)), 270);
    return () => window.clearInterval(timer);
  }, []);

  return <strong className="demo-counter">{values[index]}</strong>;
}

function DemoProgress({ phase }: { phase: number }) {
  return (
    <div className="demo-progress" aria-hidden="true">
      {phaseDurations.map((_, index) => <span className={index === phase ? "is-active" : index < phase ? "is-complete" : ""} key={index} />)}
    </div>
  );
}

function DemoFrame({ phase, children }: { phase: number; children: React.ReactNode }) {
  return (
    <div className="product-demo-frame" key={phase}>
      <DemoProgress phase={phase} />
      {children}
    </div>
  );
}

export function ProductDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase((current) => (current + 1) % phaseDurations.length), phaseDurations[phase]);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div className="product-demo" aria-label="Demostración automática del proceso de Aplica" aria-live="off">
      {phase === 0 && <DemoFrame phase={phase}>
        <div className="demo-heading"><span className="demo-eyebrow">Empezá con tu perfil</span><h2>Subí tu CV</h2></div>
        <div className="demo-upload">
          <div className="demo-upload-icon"><FileText /></div>
          <div className="demo-file"><FileText /><span><strong>CV_Fausto.pdf</strong><small>PDF · 248 KB</small></span></div>
          <p>Arrastrá tu CV acá</p>
        </div>
        <p className="demo-confirm demo-delay-late"><Check /> CV cargado</p>
      </DemoFrame>}

      {phase === 1 && <DemoFrame phase={phase}>
        <div className="demo-heading"><span className="demo-eyebrow">Tu experiencia</span><h2>Analizando tu perfil...</h2></div>
        <div className="demo-signals">
          {profileSignals.map((signal, index) => <span style={{ "--demo-order": index } as React.CSSProperties} key={signal}>{signal}</span>)}
        </div>
        <p className="demo-confirm demo-delay-late"><Check /> Perfil listo</p>
      </DemoFrame>}

      {phase === 2 && <DemoFrame phase={phase}>
        <div className="demo-search-icon"><Search /></div>
        <div className="demo-centered">
          <h2>Buscando trabajos para vos...</h2>
          <SearchCounter />
          <p>oportunidades encontradas</p>
        </div>
      </DemoFrame>}

      {phase === 3 && <DemoFrame phase={phase}>
        <div className="demo-heading"><span className="demo-eyebrow">Mejores resultados</span><h2>Trabajos que encajan con vos</h2></div>
        <div className="demo-jobs">
          {demoJobs.map(([role, match], index) => <div className="demo-job" style={{ "--demo-order": index } as React.CSSProperties} key={role}><span><strong>{role}</strong><small>Buenos Aires · Remoto</small></span><b>{match}</b></div>)}
        </div>
      </DemoFrame>}

      {phase === 4 && <DemoFrame phase={phase}>
        <div className="demo-heading"><span className="demo-eyebrow">Growth Manager · 94% match</span><h2>Adaptando tu CV...</h2></div>
        <div className="demo-resume-lines" aria-hidden="true"><span /><span /><span /></div>
        <div className="demo-checklist">
          {["Experiencia relevante priorizada", "Skills alineadas", "CV listo"].map((label, index) => <p style={{ "--demo-order": index } as React.CSSProperties} key={label}><Check />{label}</p>)}
        </div>
      </DemoFrame>}

      {phase === 5 && <DemoFrame phase={phase}>
        <div className="demo-heading"><span className="demo-eyebrow">Cola de postulaciones</span><h2>Aplicando por vos</h2></div>
        <div className="demo-queue">
          <div className="demo-queue-row is-done"><span><strong>Growth Manager</strong><small>CV adaptado</small></span><b><Check /> Aplicado</b></div>
          <div className="demo-queue-row is-done demo-queue-second"><span><strong>Growth Associate</strong><small>CV adaptado</small></span><b><Check /> Aplicado</b></div>
          <div className="demo-queue-row is-applying"><span><strong>Marketing Manager</strong><small>Preparando postulación</small></span><b>Aplicando...</b></div>
        </div>
      </DemoFrame>}

      {phase === 6 && <DemoFrame phase={phase}>
        <div className="demo-final">
          <div className="demo-final-check"><Check /></div>
          <strong>24</strong>
          <h2>aplicaciones enviadas.</h2>
          <p>Mientras vos seguís con tu día.</p>
        </div>
      </DemoFrame>}
    </div>
  );
}
