import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileText, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice, Wordmark } from "./aplica";
import { industries, skills } from "@/lib/aplica-data";
import { useAplica } from "@/lib/aplica-store";
import { cn } from "@/lib/utils";

const TOTAL = 21;
const titles = ["Empecemos por vos.", "Subí tu CV", "Revisá tu experiencia", "¿Dónde estudiaste?", "¿Qué sabés hacer?", "¿Qué idiomas hablás?", "¿Qué trabajo estás buscando?", "¿Qué nivel de puesto buscás?", "¿Dónde querés trabajar?", "¿Te mudarías por el trabajo correcto?", "¿Qué tipo de trabajo buscás?", "¿Cuánto te gustaría ganar?", "Unas preguntas que suelen aparecer al postularte", "¿Cuándo podrías empezar?", "¿Dónde te gustaría trabajar?", "¿Hay trabajos que querés evitar?", "Agregá tus perfiles profesionales", "Foto de perfil", "Ayudanos a responder aplicaciones por vos", "¿Cómo querés que Aplica trabaje por vos?", "Una última cosa"];

export function OnboardingFlow() {
  const navigate = useNavigate();
  const { onboardingStep, setOnboardingStep, completeOnboarding, name, setName } = useAplica();
  const [selected, setSelected] = useState<Record<string, string[]>>({ skills: ["Marketing", "Excel", "SQL", "Meta Ads"], roles: ["Growth Manager"], seniority: ["Semi Senior", "Senior"], mode: ["Remoto", "Híbrido"], employment: ["Full-time"], industry: ["Tecnología", "Finanzas"], dealbreakers: ["Commission-only", "Unpaid internships"] });
  const [uploaded, setUploaded] = useState(false);
  const [reading, setReading] = useState(false);
  const [consents, setConsents] = useState([false, false, false]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [matching, setMatching] = useState(false);
  const [matchStage, setMatchStage] = useState(0);
  const [count, setCount] = useState(21);

  const toggle = (group: string, value: string) => setSelected((current) => ({ ...current, [group]: current[group]?.includes(value) ? current[group]?.filter((item) => item !== value) ?? [] : [...(current[group] ?? []), value] }));
  const next = () => setOnboardingStep(Math.min(TOTAL, onboardingStep + 1));
  const finish = () => { completeOnboarding(); setMatching(true); };

  useEffect(() => {
    if (!matching) return;
    const stages = [0, 1, 2, 3, 4];
    const timers = stages.map((stage) => window.setTimeout(() => { setMatchStage(stage); setCount([21, 48, 76, 103, 127][stage] ?? 127); }, stage * 650));
    return () => timers.forEach(window.clearTimeout);
  }, [matching]);

  if (matching) return <Matching count={count} stage={matchStage} done={matchStage === 4} onDone={() => navigate({ to: "/jobs" })} />;

  return <main className="min-h-screen bg-background pb-24 md:pb-0">
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-5 md:px-8"><Wordmark compact /><div className="w-28 overflow-hidden rounded-full bg-muted md:w-52"><div className="h-1 bg-primary transition-all duration-300" style={{ width: `${(onboardingStep / TOTAL) * 100}%` }} /></div><button className="justify-self-end text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => navigate({ to: "/" })}>Guardar y salir</button></header>
    <section key={onboardingStep} className="animate-rise mx-auto w-full max-w-[680px] px-5 pb-12 pt-12 md:pt-20">
      <div className="mb-3 text-xs font-medium text-muted-foreground">{onboardingStep} de {TOTAL}</div>
      <h1 className="max-w-[620px] text-3xl font-medium leading-tight tracking-normal md:text-[40px]">{titles[onboardingStep - 1]}</h1>
      <div className="mt-8">{renderStep(onboardingStep, { selected, toggle, uploaded, setUploaded, reading, setReading, inputRef, name, setName, consents, setConsents })}</div>
      <div className="mt-10 hidden items-center justify-between md:flex"><Button variant="ghost" onClick={() => setOnboardingStep(Math.max(1, onboardingStep - 1))} disabled={onboardingStep === 1}><ArrowLeft />Atrás</Button><Button onClick={onboardingStep === TOTAL ? finish : next} disabled={onboardingStep === TOTAL && !consents.every(Boolean)}>{onboardingStep === TOTAL ? "Encontrar mis trabajos" : onboardingStep === 3 ? "Todo correcto" : "Continuar"}<ArrowRight /></Button></div>
    </section>
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background p-4 md:hidden"><Button variant="outline" size="icon" onClick={() => setOnboardingStep(Math.max(1, onboardingStep - 1))} disabled={onboardingStep === 1} aria-label="Volver"><ArrowLeft /></Button><Button className="flex-1" onClick={onboardingStep === TOTAL ? finish : next} disabled={onboardingStep === TOTAL && !consents.every(Boolean)}>{onboardingStep === TOTAL ? "Encontrar mis trabajos" : "Continuar"}<ArrowRight /></Button></div>
  </main>;
}

type StepProps = { selected: Record<string, string[]>; toggle: (group: string, value: string) => void; uploaded: boolean; setUploaded: (v: boolean) => void; reading: boolean; setReading: (v: boolean) => void; inputRef: React.RefObject<HTMLInputElement | null>; name: string; setName: (v: string) => void; consents: boolean[]; setConsents: (v: boolean[]) => void };

function renderStep(step: number, p: StepProps): ReactNode {
  const chips = (group: string, values: string[]) => <div className="flex flex-wrap gap-2">{values.map((value) => <button type="button" key={value} onClick={() => p.toggle(group, value)} className={cn("rounded-full border px-4 py-2 text-sm transition-colors", p.selected[group]?.includes(value) ? "border-primary bg-primary-soft text-primary" : "border-border hover:border-strong")}>{value}</button>)}</div>;
  switch (step) {
    case 1: return <><div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre"><Input value={p.name} onChange={(e) => p.setName(e.target.value)} /></Field><Field label="Apellido"><Input defaultValue="Fernández" /></Field><Field label="Email"><Input type="email" defaultValue="sofia@email.com" /></Field><Field label="WhatsApp"><Input defaultValue="+54 9 11 4567 8901" /></Field><Field label="País"><SelectLike options={["Argentina", "México", "Colombia", "Chile", "Uruguay"]} /></Field></div><Help>Te avisaremos cuando encontremos nuevos trabajos o una aplicación necesite tu atención.</Help></>;
    case 2: return <><p className="mb-6 text-muted-foreground">Lo usamos para completar tu perfil y encontrar oportunidades compatibles.</p><input ref={p.inputRef} className="hidden" type="file" accept=".pdf,.docx" onChange={() => { p.setReading(true); window.setTimeout(() => { p.setReading(false); p.setUploaded(true); }, 1300); }} />
      <button onClick={() => p.inputRef.current?.click()} className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-strong bg-surface px-6 text-center hover:border-primary"><Upload className="mb-4 h-7 w-7 text-primary" />{p.reading ? <><span className="font-medium animate-pulse-soft">Leyendo tu experiencia...</span><span className="mt-2 text-sm text-muted-foreground">Esto tarda sólo unos segundos.</span></> : p.uploaded ? <><FileText className="mb-3"/><span className="font-medium">CV_Sofia_Fernandez.pdf</span><span className="mt-2 text-sm text-success">Listo. Encontramos tu experiencia.</span></> : <><span className="font-medium">Arrastrá tu CV o elegí un archivo</span><span className="mt-2 text-sm text-muted-foreground">PDF o DOCX · hasta 10 MB</span></>}</button><button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground">Continuar sin CV</button></>;
    case 3: return <><p className="mb-6 text-muted-foreground">Confirmá que los datos extraídos sean correctos. Podés editar todo.</p><div className="space-y-6 border-l-2 border-primary pl-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Empresa"><Input defaultValue="Naranja X" /></Field><Field label="Puesto"><Input defaultValue="Growth Analyst" /></Field><Field label="Desde"><Input defaultValue="Mar 2023" /></Field><Field label="Hasta"><Input defaultValue="Actualidad" /></Field></div><Field label="Descripción"><Textarea defaultValue="Análisis y optimización de campañas de adquisición digital." /></Field><Field label="Logros"><Textarea defaultValue="Reduje el costo de adquisición mediante experimentos de segmentación y creatividades." /></Field></div><AddButton>Agregar experiencia</AddButton></>;
    case 4: return <><div className="grid gap-4 sm:grid-cols-2"><Field label="Institución"><Input defaultValue="Universidad de Buenos Aires" /></Field><Field label="Título"><Input defaultValue="Licenciatura" /></Field><Field label="Área de estudio"><Input defaultValue="Administración" /></Field><Field label="Año de inicio"><Input defaultValue="2018" /></Field><Field label="Año de finalización"><Input defaultValue="2022" /></Field></div><AddButton>Agregar estudio</AddButton><Skip /></>;
    case 5: return <><p className="mb-5 text-muted-foreground">Elegí sólo habilidades que realmente puedas defender en una entrevista.</p><Input className="mb-4" placeholder="Buscar o agregar una habilidad" />{chips("skills", skills)}</>;
    case 6: return <><div className="grid gap-4 sm:grid-cols-2"><Field label="Idioma"><SelectLike options={["Español", "Inglés", "Portugués"]} /></Field><Field label="Nivel"><SelectLike options={["Profesional", "Nativo", "Avanzado", "Intermedio", "Básico"]} /></Field></div><AddButton>Agregar idioma</AddButton></>;
    case 7: return <><Input className="text-base" placeholder="Growth Manager, Software Engineer, Analista financiero..." />{chips("roles", ["Growth Manager", "Growth Analyst", "Product Marketing"])}<div className="mt-7 flex items-center justify-between border-t border-border pt-5"><span className="text-sm">También me interesan puestos similares</span><Switch defaultChecked /></div><Help>Podés elegir hasta 5 roles.</Help></>;
    case 8: return <div className="grid gap-2 sm:grid-cols-2">{["Pasantía", "Entry level", "Junior", "Semi Senior", "Senior", "Lead", "Manager", "Director", "Executive"].map((v) => <Choice key={v} selected={p.selected.seniority?.includes(v) ?? false} onClick={() => p.toggle("seniority", v)}>{v}</Choice>)}</div>;
    case 9: return <><Field label="Ubicación"><Input defaultValue="Buenos Aires, Argentina" /></Field><h2 className="mb-4 mt-8 text-lg font-medium">¿Cómo querés trabajar?</h2>{chips("mode", ["Remoto", "Híbrido", "Presencial"])}<div className="mt-8 flex items-center justify-between border-t border-border pt-5"><span className="max-w-md text-sm">¿Trabajarías para una empresa de otro país de forma remota?</span><Switch defaultChecked /></div></>;
    case 10: return <div className="space-y-2">{["Sí", "No", "Depende de la oportunidad"].map((v, i) => <Choice key={v} selected={i === 2} onClick={() => undefined}>{v}</Choice>)}</div>;
    case 11: return <div className="grid gap-2 sm:grid-cols-2">{["Full-time", "Part-time", "Contractor", "Freelance", "Internship", "Temporary"].map((v) => <Choice key={v} selected={p.selected.employment?.includes(v) ?? false} onClick={() => p.toggle("employment", v)}>{v}</Choice>)}</div>;
    case 12: return <><div className="grid gap-4 sm:grid-cols-3"><Field label="Moneda"><SelectLike options={["USD", "ARS", "MXN", "BRL"]} /></Field><Field label="Mínimo deseado"><Input inputMode="numeric" defaultValue="3200" /></Field><Field label="Período"><SelectLike options={["Mensual", "Anual", "Por hora"]} /></Field></div><label className="mt-6 flex items-center gap-3 text-sm"><Checkbox /> Prefiero no filtrar trabajos por salario</label><Help>Sólo usaremos este dato para evitar oportunidades que estén claramente por debajo de lo que buscás.</Help></>;
    case 13: return <><p className="mb-6 text-muted-foreground">Estas respuestas siempre salen directamente de vos. Nunca inferimos tu situación migratoria.</p><div className="space-y-7"><Question title="¿Tenés autorización legal para trabajar en Estados Unidos?" /><Question title="¿Necesitás sponsorship ahora o en el futuro?" /></div></>;
    case 14: return <div className="space-y-2">{["Inmediatamente", "1–2 semanas", "2–4 semanas", "1–2 meses", "Elegir fecha"].map((v, i) => <Choice key={v} selected={i === 1} onClick={() => undefined}>{v}</Choice>)}</div>;
    case 15: return <><h2 className="mb-4 text-sm font-medium">Tamaño de empresa</h2>{chips("size", ["Startup", "Empresa pequeña", "Empresa mediana", "Empresa grande", "Sin preferencia"])}<h2 className="mb-4 mt-8 text-sm font-medium">Industrias que te interesan</h2>{chips("industry", industries)}</>;
    case 16: return <>{chips("dealbreakers", ["Commission-only", "Turno noche", "Fines de semana", "Requiere mudanza", "Viajes frecuentes", "Unpaid internships", "Contractor", "Sólo presencial"])}<Input className="mt-5" placeholder="Agregar otra preferencia" /></>;
    case 17: return <div className="space-y-4">{["LinkedIn", "GitHub", "Portfolio", "Behance", "Sitio personal"].map((v) => <Field key={v} label={v}><Input placeholder="https://" /></Field>)}</div>;
    case 18: return <><p className="mb-6 text-sm font-medium text-primary">Opcional</p><button className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl border border-dashed border-strong bg-surface"><Upload className="mb-3 text-muted-foreground"/><span className="text-sm font-medium">Subir una foto</span></button><Help>No necesitamos una foto para encontrar trabajos. Sólo la usaremos si vos decidís incluirla en algún perfil o aplicación.</Help><Skip /></>;
    case 19: return <><p className="mb-7 text-muted-foreground">Respondelas una vez y no vas a tener que hacerlo cien veces.</p><div className="space-y-5"><Field label="¿Por qué estás buscando un nuevo rol?"><Textarea placeholder="Responder después" /></Field><Field label="¿Qué tipo de rol te interesa más?"><Textarea placeholder="Responder después" /></Field><Field label="Describí un logro profesional"><Textarea placeholder="Responder después" /></Field><Question title="¿Te sentís cómoda viajando por trabajo?" /></div><Help>Podés completar o editar estas respuestas más adelante.</Help></>;
    case 20: return <div className="space-y-3"><Choice selected={false} onClick={() => undefined} description="Aplicamos cuando un trabajo cumple tus criterios.">Automático</Choice><Choice selected onClick={() => undefined} description="Te mostramos cada oportunidad antes de enviar.">Con revisión</Choice><Help>Siempre te pediremos ayuda si encontramos una pregunta que no podemos responder con seguridad.</Help></div>;
    case 21: return <><p className="mb-7 text-muted-foreground">Tu información es la base de cada aplicación.</p><div className="space-y-4">{["La información que proporcioné es verdadera.", "Autorizo a Aplica a utilizar estos datos para completar aplicaciones laborales que yo seleccione o autorice.", "Entiendo que Aplica puede reformular mi CV, pero nunca debe inventar experiencia, estudios o habilidades."].map((text, i) => <label key={text} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 text-sm leading-6"><Checkbox checked={p.consents[i]} onCheckedChange={() => { const next = [...p.consents]; next[i] = !next[i]; p.setConsents(next); }} className="mt-0.5" /><span>{text}</span></label>)}</div></>;
    default: return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium">{label}<div className="mt-2">{children}</div></label>; }
function Help({ children }: { children: ReactNode }) { return <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">{children}</p>; }
function Skip() { return <button className="mt-5 text-sm text-muted-foreground hover:text-foreground">Omitir por ahora</button>; }
function AddButton({ children }: { children: ReactNode }) { return <Button variant="outline" className="mt-6"><Plus />{children}</Button>; }
function SelectLike({ options }: { options: string[] }) { return <select className="h-12 w-full rounded-[10px] border border-input bg-background px-3.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft">{options.map((o) => <option key={o}>{o}</option>)}</select>; }
function Question({ title }: { title: string }) { return <div><p className="mb-3 text-sm font-medium">{title}</p><div className="grid grid-cols-2 gap-2"><Choice selected onClick={() => undefined}>Sí</Choice><Choice selected={false} onClick={() => undefined}>No</Choice></div></div>; }

function Matching({ count, stage, done, onDone }: { count: number; stage: number; done: boolean; onDone: () => void }) {
  const labels = ["Analizando tu experiencia", "Comparando requisitos", "Descartando trabajos irrelevantes", "Ordenando tus mejores oportunidades", "Listo"];
  return <main className="flex min-h-screen items-center justify-center bg-background px-5"><div className="w-full max-w-xl text-center"><Wordmark /><div className="mx-auto my-14 h-1 w-56 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${((stage + 1) / 5) * 100}%` }} /></div><p className="text-sm text-muted-foreground">{done ? "Encontramos" : "Buscando oportunidades para vos..."}</p><div className="mt-3 text-6xl font-medium tabular-nums tracking-normal">{count}</div><p className="mt-2 text-xl">{done ? "oportunidades para vos." : "trabajos encontrados"}</p><p className="mt-10 text-sm text-muted-foreground transition-all">{done ? "Ordenados según qué tan bien encajan con tu perfil." : labels[stage]}</p>{done && <Button className="mt-8" size="lg" onClick={onDone}>Ver mis trabajos<ArrowRight /></Button>}</div></main>;
}
