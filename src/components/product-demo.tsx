import { Check, FileText, Search } from "lucide-react";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const phaseDurations = [1800, 1800, 2200, 2400, 2100, 2400, 2000];
const exitDuration = 420;
const profileSignals = [
  "Growth",
  "Marketing",
  "Buenos Aires",
  "Inglés",
  "Español",
  "Remoto",
];

const demoJobs = [
  {
    role: "Growth Manager",
    company: "Empresa tecnológica",
    match: "94% match",
  },
  {
    role: "Growth Associate",
    company: "Startup B2B",
    match: "91% match",
  },
  {
    role: "Marketing Manager",
    company: "Producto digital",
    match: "88% match",
  },
];

function DemoProgress({ phase }: { phase: number }) {
  return (
    <div className="demo-progress" aria-hidden="true">
      {phaseDurations.map((duration, index) => (
        <span
          className={
            index === phase
              ? "is-active"
              : index < phase
                ? "is-complete"
                : ""
          }
          key={index}
          style={
            {
              "--demo-phase-duration": `${duration}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function GenericLogo({ label }: { label: string }) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return <span className="demo-job-logo demo-job-logo-text">{initials}</span>;
}

function phaseContent(phase: number): ReactNode {
  if (phase === 0) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">Empezá con tu perfil</span>
          <h2>Subí tu CV</h2>
        </div>
        <div className="demo-upload">
          <div className="demo-upload-icon">
            <FileText />
          </div>
          <div className="demo-file">
            <FileText />
            <span>
              <strong>Tu_CV.pdf</strong>
              <small>PDF o DOCX</small>
            </span>
          </div>
          <p>Arrastrá tu CV acá</p>
        </div>
        <p className="demo-confirm demo-delay-late">
          <Check /> CV cargado
        </p>
      </>
    );
  }

  if (phase === 1) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">Tu experiencia</span>
          <h2>Entendiendo tu perfil...</h2>
        </div>
        <div className="demo-signals">
          {profileSignals.map((signal, index) => (
            <span
              style={{ "--demo-order": index } as CSSProperties}
              key={signal}
            >
              {signal}
            </span>
          ))}
        </div>
        <p className="demo-confirm demo-delay-late">
          <Check /> Perfil listo
        </p>
      </>
    );
  }

  if (phase === 2) {
    return (
      <>
        <div className="demo-search-icon">
          <Search />
        </div>
        <div className="demo-centered">
          <h2>Buscando trabajos actualizados...</h2>
          <p className="demo-search-copy">
            Revisamos inventario público y descartamos vacantes cerradas o no
            compatibles.
          </p>
        </div>
      </>
    );
  }

  if (phase === 3) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">Ejemplo de resultado</span>
          <h2>Trabajos que encajan con vos</h2>
        </div>
        <div className="demo-jobs">
          {demoJobs.map((job, index) => (
            <div
              className="demo-job"
              style={{ "--demo-order": index } as CSSProperties}
              key={job.role}
            >
              <GenericLogo label={job.company} />
              <span>
                <strong>{job.role}</strong>
                <small>{job.company} · Remoto</small>
              </span>
              <b>{job.match}</b>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (phase === 4) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">CV por vacante</span>
          <h2>Adaptando tu CV...</h2>
        </div>
        <div className="demo-resume-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-checklist">
          {[
            "Experiencia relevante priorizada",
            "Skills confirmadas",
            "Sin inventar información",
          ].map((label, index) => (
            <p
              style={{ "--demo-order": index } as CSSProperties}
              key={label}
            >
              <Check />
              {label}
            </p>
          ))}
        </div>
      </>
    );
  }

  if (phase === 5) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">Auto Apply</span>
          <h2>Preparando postulaciones</h2>
        </div>
        <div className="demo-queue">
          {demoJobs.map((job, index) => (
            <div
              className={
                index < 2
                  ? "demo-queue-row is-done"
                  : "demo-queue-row is-applying"
              }
              style={{ "--demo-order": index } as CSSProperties}
              key={job.role}
            >
              <GenericLogo label={job.company} />
              <span>
                <strong>{job.role}</strong>
                <small>
                  {index < 2 ? "CV listo" : "Preparando formulario"}
                </small>
              </span>
              <b>
                {index < 2 ? (
                  <>
                    <Check /> Lista
                  </>
                ) : (
                  "Preparando..."
                )}
              </b>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="demo-final">
      <div className="demo-final-check">
        <Check />
      </div>
      <h2>Listo para aplicar.</h2>
      <p>Vos elegís las vacantes. Aplica hace el trabajo repetitivo.</p>
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
    <div
      className="product-demo"
      aria-label="Demostración ilustrativa del proceso de Aplica"
      aria-live="off"
    >
      <span className="demo-illustrative-badge">Demo ilustrativa</span>
      {exiting !== null && exiting !== phase && (
        <div
          className="product-demo-frame is-exiting"
          key={`exit-${exiting}`}
          aria-hidden="true"
        >
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
