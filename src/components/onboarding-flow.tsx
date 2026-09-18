import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileText, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice } from "./aplica";
import { OnboardingShell } from "./onboarding-shell";
import { industries, skills } from "@/lib/aplica-data";
import { useAplica } from "@/lib/aplica-store";
import { cn } from "@/lib/utils";

const TOTAL = 14;
const titles = [
  "¿Qué trabajo estás buscando?", "Empecemos por tu experiencia", "Tus datos", "Revisá tu experiencia",
  "¿Dónde estudiaste?", "¿Qué sabés hacer?", "¿Qué idiomas hablás?", "¿Qué puestos te interesan?",
  "¿Cómo querés trabajar?", "¿Dónde trabajarías?", "¿Qué salario buscás?", "¿Qué nivel de puesto buscás?",
  "Algunas preguntas frecuentes", "Últimos detalles",
];

type Answers = Record<string, string[]>;

type Profile = {
  firstName: string; lastName: string; email: string; phone: string; country: string; city: string;
  company: string; role: string; start: string; end: string; description: string; achievements: string;
  institution: string; degree: string; area: string; studyDates: string; language: string; level: string;
};

const emptyProfile: Profile = {
  firstName: "", lastName: "", email: "", phone: "", country: "", city: "",
  company: "", role: "", start: "", end: "", description: "", achievements: "",
  institution: "", degree: "", area: "", studyDates: "", language: "Español", level: "Nativo",
};

const parsedProfile: Profile = {
  firstName: "Sofía", lastName: "Fernández", email: "sofia@email.com", phone: "+54 9 11 4567 8901",
  country: "Argentina", city: "Buenos Aires",
  company: "Naranja X", role: "Growth Analyst", start: "Mar 2023", end: "Actualidad",
  description: "Análisis y optimización de campañas de adquisición digital.",
  achievements: "Reduje el costo de adquisición con experimentos de segmentación.",
  institution: "Universidad de Buenos Aires", degree: "Licenciatura", area: "Administración",
  studyDates: "2018 — 2022", language: "Español", level: "Nativo",
};

export function OnboardingFlow() {
  const navigate = useNavigate();
  const { onboardingStep, setOnboardingStep, completeOnboarding, name, setName, searchPreferences, setSearchPreferences } = useAplica();
  const step = Math.min(TOTAL, Math.max(1, onboardingStep));
  const [selected, setSelected] = useState<Answers>({
    skills: [], roles: [searchPreferences.role || "Growth Manager"],
    mode: [searchPreferences.mode || "Remoto"], employment: ["Full-time"], seniority: [],
    industry: [], size: [], avoid: [], dealbreakers: [],
  });
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [cvParsed, setCvParsed] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [reading, setReading] = useState(false);
  const [consents, setConsents] = useState([false, false]);
  const [matching, setMatching] = useState(false);
  const [matchStage, setMatchStage] = useState(0);
  const [count, setCount] = useState(23);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (group: string, value: string) => setSelected((current) => ({
    ...current,
    [group]: current[group]?.includes(value) ? current[group].filter((item) => item !== value) : [...(current[group] ?? []), value],
  }));
  const next = () => setOnboardingStep(Math.min(TOTAL, step + 1));
  const back = () => setOnboardingStep(Math.max(1, step - 1));
  const finish = () => { completeOnboarding(); setMatching(true); };

  const updateProfile = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  const acceptFile = (file?: File) => {
    if (!file || reading) return;
    setUploadedName(file.name);
    setReading(true);
    window.setTimeout(() => {
      setReading(false);
      setProfile(parsedProfile);
      setCvParsed(true);
      if (!name) setName(parsedProfile.firstName);
      setSearchPreferences({ ...searchPreferences, location: searchPreferences.location || parsedProfile.city });
      setSelected((current) => ({
        ...current,
        skills: ["Marketing", "Excel", "SQL", "Meta Ads"],
        seniority: ["Semi Senior"],
        industry: ["Tecnología", "Finanzas"],
      }));
      setOnboardingStep(3);
    }, 1300);
  };
  const skipCv = () => {
    setProfile(emptyProfile);
    setCvParsed(false);
    setUploadedName("");
    setOnboardingStep(3);
  };
  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files[0]);
  };

  useEffect(() => {
    if (!matching) return;
    const values = [23, 48, 76, 104, 127];
    const timers = values.map((value, index) => window.setTimeout(() => {
      setMatchStage(index);
      setCount(value);
    }, index * 680));
    return () => timers.forEach(window.clearTimeout);
  }, [matching]);

  return (
    <OnboardingShell flow className="onboarding-sheet-flow">
      {matching ? <Matching count={count} stage={matchStage} done={matchStage === 4} onDone={() => void navigate({ to: "/jobs" })} /> : <>
        <div className="sheet-progress">
          <span>Paso {step} de {TOTAL}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => void navigate({ to: "/" })}>Guardar y salir</Button>
        </div>
        <div className="sheet-progress-track"><span style={{ width: `${(step / TOTAL) * 100}%` }} /></div>

        <div key={step} className="sheet-step">
          <h2>{titles[step - 1]}</h2>
          <div className="sheet-step-body">
            {renderStep(step, { selected, toggle, name, setName, searchPreferences, setSearchPreferences, reading, uploadedName, inputRef, acceptFile, dropFile, consents, setConsents, profile, updateProfile, cvParsed, skipCv })}
          </div>
        </div>

        <div className="sheet-actions">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 1}><ArrowLeft /> Atrás</Button>
          <Button type="button" className="home-primary min-w-36" onClick={step === TOTAL ? finish : next} disabled={step === TOTAL && !consents.every(Boolean)}>
            {step === TOTAL ? "Buscar mis trabajos" : step === 4 ? "Todo correcto" : "Continuar"} <ArrowRight />
          </Button>
        </div>
      </>}
    </OnboardingShell>
  );
}

type StepProps = {
  selected: Answers; toggle: (group: string, value: string) => void; name: string; setName: (value: string) => void;
  searchPreferences: { role: string; location: string; mode: string }; setSearchPreferences: (value: { role: string; location: string; mode: string }) => void;
  reading: boolean; uploadedName: string; inputRef: React.RefObject<HTMLInputElement | null>; acceptFile: (file?: File) => void;
  dropFile: (event: DragEvent<HTMLDivElement>) => void; consents: boolean[]; setConsents: (value: boolean[]) => void;
  profile: Profile; updateProfile: (key: keyof Profile, value: string) => void; cvParsed: boolean; skipCv: () => void;
};

function CvNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="sheet-help mb-4 flex items-center gap-2 text-primary"><Check className="size-4" /> Completado automáticamente desde tu CV. Revisalo y editá lo que haga falta.</p>;
}

function renderStep(step: number, p: StepProps): ReactNode {
  const chips = (group: string, values: string[]) => <div className="sheet-chips">{values.map((value) => <Button type="button" variant="outline" key={value} onClick={() => p.toggle(group, value)} className={cn("sheet-chip", p.selected[group]?.includes(value) && "sheet-chip-selected")}>{value}</Button>)}</div>;
  const updateSearch = (key: "role" | "location" | "mode", value: string) => p.setSearchPreferences({ ...p.searchPreferences, [key]: value });
  switch (step) {
    case 1: return <div className="space-y-5"><Field label="Puesto o área"><Input value={p.searchPreferences.role} onChange={(event) => updateSearch("role", event.target.value)} placeholder="Growth Manager" /></Field><Field label="Ubicación"><Input value={p.searchPreferences.location} onChange={(event) => updateSearch("location", event.target.value)} placeholder="Buenos Aires" /></Field><Field label="Modalidad">{chips("mode", ["Remoto", "Híbrido", "Presencial"])}</Field></div>;
    case 2: return <><p className="sheet-copy">Subí tu CV y completamos gran parte del perfil por vos.</p><input ref={p.inputRef} className="hidden" type="file" accept=".pdf,.docx" onChange={(event) => p.acceptFile(event.target.files?.[0])} /><div className="sheet-upload" role="button" tabIndex={0} onClick={() => p.inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") p.inputRef.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={p.dropFile}>{p.reading ? <><span className="sheet-upload-icon animate-pulse-soft"><FileText /></span><strong>Leyendo tu experiencia…</strong><span>{p.uploadedName}</span></> : p.uploadedName ? <><span className="sheet-upload-icon"><Check /></span><strong>{p.uploadedName}</strong><span>Documento listo</span></> : <><span className="sheet-upload-icon"><Upload /></span><strong>Subí tu CV</strong><span>PDF o DOCX · arrastrá o elegí un archivo</span></>}</div><Button type="button" variant="ghost" className="mt-3 w-full text-muted-foreground" onClick={() => p.setSearchPreferences(p.searchPreferences)}>Continuar sin CV</Button></>;
    case 3: return <div className="sheet-field-grid"><Field label="Nombre"><Input value={p.name} onChange={(event) => p.setName(event.target.value)} /></Field><Field label="Apellido"><Input defaultValue="Fernández" /></Field><Field label="Email"><Input type="email" defaultValue="sofia@email.com" /></Field><Field label="WhatsApp"><Input defaultValue="+54 9 11 4567 8901" /></Field><Field label="País"><SelectLike options={["Argentina", "México", "Colombia", "Chile", "Uruguay"]} /></Field><Field label="Ciudad"><Input defaultValue={p.searchPreferences.location || "Buenos Aires"} /></Field></div>;
    case 4: return <><p className="sheet-copy">Confirmá que los datos extraídos sean correctos. Podés editar todo.</p><div className="sheet-experience"><div className="sheet-field-grid"><Field label="Empresa"><Input defaultValue="Naranja X" /></Field><Field label="Puesto"><Input defaultValue="Growth Analyst" /></Field><Field label="Fecha de inicio"><Input defaultValue="Mar 2023" /></Field><Field label="Fecha de fin"><Input defaultValue="Actualidad" /></Field></div><Field label="Descripción"><Textarea defaultValue="Análisis y optimización de campañas de adquisición digital." /></Field><Field label="Logros"><Textarea defaultValue="Reduje el costo de adquisición con experimentos de segmentación." /></Field></div><AddButton>Agregar experiencia</AddButton></>;
    case 5: return <><div className="sheet-field-grid"><Field label="Institución"><Input defaultValue="Universidad de Buenos Aires" /></Field><Field label="Carrera o título"><Input defaultValue="Licenciatura" /></Field><Field label="Área"><Input defaultValue="Administración" /></Field><Field label="Fechas"><Input defaultValue="2018 — 2022" /></Field></div><AddButton>Agregar estudio</AddButton></>;
    case 6: return <><p className="sheet-copy">Elegí sólo habilidades que realmente puedas defender.</p><div className="relative mb-4"><Search className="sheet-field-icon" /><Input className="pl-11" placeholder="Buscar o agregar una habilidad" /></div>{chips("skills", skills)}</>;
    case 7: return <><div className="sheet-field-grid"><Field label="Idioma"><SelectLike options={["Español", "Inglés", "Portugués"]} /></Field><Field label="Nivel"><SelectLike options={["Básico", "Intermedio", "Avanzado", "Profesional", "Nativo"]} /></Field></div><AddButton>Agregar idioma</AddButton></>;
    case 8: return <><Input className="mb-4" placeholder="Buscar un puesto" />{chips("roles", ["Growth Manager", "Growth Analyst", "Product Marketing", "Business Analyst"])}<ToggleRow label="También mostrar puestos similares" /></>;
    case 9: return <><SectionLabel>Modalidad</SectionLabel>{chips("mode", ["Remoto", "Híbrido", "Presencial"])}<SectionLabel>Tipo de trabajo</SectionLabel>{chips("employment", ["Full-time", "Part-time", "Contractor", "Freelance"])}</>;
    case 10: return <><Field label="Ciudad o país"><Input defaultValue={p.searchPreferences.location || "Buenos Aires, Argentina"} /></Field><ToggleRow label="¿Trabajarías remoto para empresas de otros países?" /><SectionLabel>¿Te mudarías por una buena oportunidad?</SectionLabel>{chips("relocate", ["Sí", "No", "Depende"])}</>;
    case 11: return <><div className="sheet-field-grid sheet-field-grid-3"><Field label="Moneda"><SelectLike options={["USD", "ARS", "MXN", "BRL"]} /></Field><Field label="Mínimo esperado"><Input inputMode="numeric" defaultValue="3200" /></Field><Field label="Período"><SelectLike options={["Mensual", "Anual"]} /></Field></div><label className="mt-5 flex items-center gap-3 text-sm"><Checkbox /> No quiero filtrar por salario</label></>;
    case 12: return <>{chips("seniority", ["Entry level", "Junior", "Semi Senior", "Senior", "Lead", "Manager", "Director"])}<p className="sheet-help">Podés elegir niveles adyacentes.</p></>;
    case 13: return <><p className="sheet-copy">Estas respuestas salen directamente de vos. Nunca inferimos tu situación migratoria.</p><Question title="¿Tenés autorización para trabajar en Estados Unidos?" /><Question title="¿Necesitarías sponsorship?" /></>;
    case 14: return <><SectionLabel>Industrias que te gustan</SectionLabel>{chips("industry", industries.slice(0, 6))}<SectionLabel>Tamaño de empresa</SectionLabel>{chips("size", ["Startup", "Pequeña", "Mediana", "Grande"])}<SectionLabel>Condiciones que querés evitar</SectionLabel>{chips("dealbreakers", ["No trabajos a comisión", "No presencial", "No fines de semana", "No relocation", "No roles sin pago"])}<div className="mt-5 space-y-3">{["La información que proporcioné es verdadera.", "Aplica puede reformular mi CV, pero nunca inventar experiencia, estudios o habilidades."].map((text, index) => <label key={text} className="sheet-consent"><Checkbox checked={p.consents[index] ?? false} onCheckedChange={() => { const next = [...p.consents]; next[index] = !next[index]; p.setConsents(next); }} /><span>{text}</span></label>)}</div></>;
    default: return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="sheet-field"><span>{label}</span>{children}</label>; }
function SectionLabel({ children }: { children: ReactNode }) { return <h3 className="mb-3 mt-6 text-sm font-medium first:mt-0">{children}</h3>; }
function AddButton({ children }: { children: ReactNode }) { return <Button type="button" variant="outline" size="sm" className="mt-4"><Plus />{children}</Button>; }
function SelectLike({ options }: { options: string[] }) { return <select className="sheet-select">{options.map((option) => <option key={option}>{option}</option>)}</select>; }
function ToggleRow({ label }: { label: string }) { return <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border pt-5"><span className="min-w-0 text-sm">{label}</span><Switch className="shrink-0" defaultChecked /></div>; }
function Question({ title }: { title: string }) { return <div className="mb-5"><p className="mb-3 text-sm font-medium">{title}</p><div className="grid grid-cols-2 gap-2"><Choice selected onClick={() => undefined}>Sí</Choice><Choice selected={false} onClick={() => undefined}>No</Choice></div></div>; }

function Matching({ count, stage, done, onDone }: { count: number; stage: number; done: boolean; onDone: () => void }) {
  const status = ["Analizando tu perfil", "Encontrando puestos relevantes", "Comparando requisitos", "Ordenando tus mejores matches", "Listo"];
  return <div className="matching-card"><div className="matching-orbit"><span>{done ? <Check /> : count}</span></div>{done ? <><p className="sheet-kicker">Búsqueda completa</p><h2>Encontramos 127 trabajos para vos.</h2><p className="sheet-subtitle">Ordenados según qué tan bien coinciden con tu experiencia y preferencias.</p><Button className="home-primary mt-8 h-12 px-7" onClick={onDone}>Ver trabajos <ArrowRight /></Button></> : <><h2>Buscando oportunidades para vos</h2><div className="matching-count">{count}</div><p className="sheet-subtitle">oportunidades</p><p className="matching-status">{status[stage]}</p></>}</div>;
}