import {
  Check,
  FileText,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const phaseDurations = [1800, 1800, 2200, 2200, 2100, 2300, 1900];
const exitDuration = 420;

const profileSignals = [
  "Experiencia extraída",
  "Skills confirmadas",
  "Idiomas",
  "Ubicación",
  "Preferencias",
  "Autorización laboral",
];

const jobChecks = [
  "Rol y responsabilidades compatibles",
  "Ubicación y modalidad compatibles",
  "Formulario verificado para Auto Apply",
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
            { "--demo-phase-duration": `${duration}ms` } as CSSProperties
          }
        />
      ))}
    </div>
  );
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
              <strong>CV.pdf</strong>
              <small>Documento cargado</small>
            </span>
          </div>
          <p>PDF o DOCX</p>
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
          <span className="demo-eyebrow">Tu Career Profile</span>
          <h2>Entendiendo tu experiencia…</h2>
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
          <ShieldCheck /> Hechos listos para revisar
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
          <h2>Buscando inventario actualizado…</h2>
          <p className="mx-auto mt-5 max-w-[330px] leading-6">
            Aplica revisa vacantes activas y descarta formularios que ya no se
            pueden completar de punta a punta.
          </p>
        </div>
      </>
    );
  }

  if (phase === 3) {
    return (
      <>
        <div className="demo-heading">
          <span className="demo-eyebrow">Matching verificable</span>
          <h2>Primero comprobamos el encaje</h2>
        </div>
        <div className="demo-jobs">
          {jobChecks.map((label, index) => (
            <div
              className="demo-job"
              style={{ "--demo-order": index } as CSSProperties}
              key={label}
            >
              <div className="demo-job-logo grid place-items-center bg-primary-soft text-primary">
                <Check className="h-4 w-4" />
              </div>
              <span>
                <strong>{label}</strong>
                <small>Señal calculada con tu perfil real</small>
              </span>
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
          <span className="demo-eyebrow">CV específico por vacante</span>
          <h2>Adaptando la presentación…</h2>
        </div>
        <div className="demo-resume-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="demo-checklist">
          {[
            "Experiencia relevante priorizada",
            "Redacción adaptada al puesto",
            "Sin agregar habilidades ni logros",
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
          <h2>Preparando la postulación</h2>
        </div>
        <div className="demo-queue">
          {[
            ["CV", "Archivo generado y validado"],
            ["Preguntas", "Respuestas basadas en datos confirmados"],
            ["Formulario", "Listo para envío automático"],
          ].map(([label, detail], index) => (
            <div
              className="demo-queue-row is-done"
              style={{ "--demo-order": index } as CSSProperties}
              key={label}
            >
              <div className="demo-job-logo grid place-items-center bg-primary-soft text-primary">
                {index === 0 ? (
                  <FileText className="h-4 w-4" />
                ) : index === 1 ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
              </div>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <b>
                <Check /> Listo
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
      <h2>Todo listo para aplicar.</h2>
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
