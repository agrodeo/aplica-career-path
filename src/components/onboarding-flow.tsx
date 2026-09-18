import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice } from "./aplica";
import { OnboardingShell } from "./onboarding-shell";
import { industries, skills } from "@/lib/aplica-data";
import { useAplica } from "@/lib/aplica-store";
import { refreshJobMatches } from "@/lib/auto-apply.functions";
import { getOnboardingSeed, saveOnboardingProfile } from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
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


export function OnboardingFlow() {
  const navigate = useNavigate();
  const { onboardingStep, setOnboardingStep, completeOnboarding, name, setName, searchPreferences, setSearchPreferences } = useAplica();
  const step = Math.min(TOTAL, Math.max(1, onboardingStep));
  const [selected, setSelected] = useState<Answers>({
    skills: [], roles: searchPreferences.role ? [searchPreferences.role] : [],
    mode: [searchPreferences.mode || "Remoto"], employment: ["Full-time"], seniority: [],
    industry: [], size: [], avoid: [], dealbreakers: [],
  });
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [cvParsed, setCvParsed] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [reading, setReading] = useState(false);
  const [consents, setConsents] = useState([false, false, false]);
  const [sensitiveAnswers, setSensitiveAnswers] = useState<{ workAuthorization: boolean | null; sponsorship: boolean | null }>({
    workAuthorization: null,
    sponsorship: null,
  });
  const [internationalRemote, setInternationalRemote] = useState(true);
  const [salaryCurrency, setSalaryCurrency] = useState("USD");
  const [minimumSalary, setMinimumSalary] = useState("");
  const [salaryPeriod, setSalaryPeriod] = useState("Mensual");
  const [skipSalary, setSkipSalary] = useState(false);
  const [baseResumePath, setBaseResumePath] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matchStage, setMatchStage] = useState(0);
  const [count, setCount] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);
  const persistOnboarding = useServerFn(saveOnboardingProfile);
  const fetchOnboardingSeed = useServerFn(getOnboardingSeed);
  const calculateMatches = useServerFn(refreshJobMatches);
  const [seedLoaded, setSeedLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (group: string, value: string) => setSelected((current) => ({
    ...current,
    [group]: current[group]?.includes(value) ? current[group].filter((item) => item !== value) : [...(current[group] ?? []), value],
  }));
  const next = () => setOnboardingStep(Math.min(TOTAL, step + 1));
  const back = () => setOnboardingStep(Math.max(1, step - 1));

  const finish = async () => {
    if (saving || !consents.every(Boolean)) return;
    setSaving(true);
    setSaveError(null);

    try {
      const targetRoles = [...new Set([searchPreferences.role, ...(selected.roles ?? [])].map((value) => value.trim()).filter(Boolean))];
      const targetLocations = [searchPreferences.location || profile.city || profile.country].filter(Boolean);
      const relocate = selected.relocate?.[0] ?? "No";

      await persistOnboarding({
        data: {
          identity: {
            firstName: (name || profile.firstName).trim(),
            lastName: profile.lastName.trim(),
            email: profile.email.trim(),
            phone: profile.phone.trim(),
            country: profile.country.trim(),
            city: (profile.city || searchPreferences.location).trim(),
            currentTitle: profile.role.trim(),
          },
          experience: profile.company.trim() && profile.role.trim()
            ? {
                company: profile.company,
                title: profile.role,
                start: profile.start,
                end: profile.end,
                description: profile.description,
                achievements: profile.achievements,
              }
            : null,
          education: profile.institution.trim()
            ? {
                institution: profile.institution,
                degree: profile.degree,
                field: profile.area,
                studyDates: profile.studyDates,
              }
            : null,
          skills: selected.skills ?? [],
          languages: profile.language.trim()
            ? [{ language: profile.language, level: profile.level }]
            : [],
          preferences: {
            targetRoles,
            targetLocations,
            modes: selected.mode ?? [],
            employmentTypes: selected.employment ?? [],
            seniorityLevels: selected.seniority ?? [],
            willingToRelocate: relocate === "Sí" || relocate === "Depende",
            internationalRemote,
            minimumSalary: skipSalary || !minimumSalary.trim() ? null : Number(minimumSalary),
            salaryCurrency: skipSalary ? null : salaryCurrency,
            salaryPeriod: skipSalary ? null : salaryPeriod,
            preferredIndustries: selected.industry ?? [],
            dealbreakers: selected.dealbreakers ?? [],
            minimumMatchScore: 70,
          },
          sensitiveAnswers,
          baseResumePath,
          authorizeAutoApply: consents[2] === true,
        },
      });

      const result = await calculateMatches();
      setMatchedCount(result.readyCount);
      setCount(0);
      completeOnboarding();
      setMatching(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No pudimos guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  const acceptFile = (file?: File) => {
    if (!file || reading) return;
    setUploadedName(file.name);
    setReading(true);
    setCvError(null);

    void (async () => {
      let fields: Partial<Profile> = {};
      let foundSkills: string[] = [];

      try {
        const { parseCvFile } = await import("@/lib/cv-parse");
        const result = await parseCvFile(file);
        fields = result.fields as Partial<Profile>;
        foundSkills = result.skills;
      } catch (error) {
        setCvError(error instanceof Error ? error.message : "No pudimos leer el CV.");
      }

      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Tu sesión venció. Ingresá de nuevo.");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
        const storagePath = `${data.user.id}/base/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(storagePath, file, {
            contentType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            upsert: false,
          });
        if (uploadError) throw uploadError;
        setBaseResumePath(storagePath);
      } catch (error) {
        setCvError(error instanceof Error ? `Leímos tu CV, pero no pudimos guardarlo: ${error.message}` : "No pudimos guardar tu CV.");
      }

      const merged: Profile = { ...emptyProfile, ...fields };
      setReading(false);
      setProfile(merged);
      setCvParsed(Object.values(fields).some((value) => typeof value === "string" && value.trim().length > 0));
      if (merged.firstName) setName(merged.firstName);
      if (merged.city) setSearchPreferences({ ...searchPreferences, location: searchPreferences.location || merged.city });
      if (foundSkills.length) setSelected((current) => ({ ...current, skills: foundSkills }));
      setOnboardingStep(3);
    })();
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
    if (seedLoaded) return;
    let active = true;

    void fetchOnboardingSeed()
      .then((seed) => {
        if (!active) return;

        setName(seed.identity.firstName || name);
        setProfile((current) => ({
          ...current,
          firstName: seed.identity.firstName,
          lastName: seed.identity.lastName,
          email: seed.identity.email,
          phone: seed.identity.phone,
          country: seed.identity.country,
          city: seed.identity.city,
          company: seed.experience?.company ?? current.company,
          role: seed.experience?.title ?? seed.identity.currentTitle ?? current.role,
          start: seed.experience?.start ?? current.start,
          end: seed.experience?.end ?? current.end,
          description: seed.experience?.description ?? current.description,
          achievements: seed.experience?.achievements ?? current.achievements,
          institution: seed.education?.institution ?? current.institution,
          degree: seed.education?.degree ?? current.degree,
          area: seed.education?.field ?? current.area,
          studyDates: seed.education?.studyDates ?? current.studyDates,
          language: seed.languages[0]?.language ?? current.language,
          level: seed.languages[0]?.level ?? current.level,
        }));

        if (seed.skills.length) {
          setSelected((current) => ({
            ...current,
            skills: seed.skills,
            roles: seed.preferences?.targetRoles?.length
              ? seed.preferences.targetRoles
              : current.roles,
            mode: seed.preferences?.modes?.length
              ? seed.preferences.modes
              : current.mode,
            employment: seed.preferences?.employmentTypes?.length
              ? seed.preferences.employmentTypes
              : current.employment,
            seniority: seed.preferences?.seniorityLevels?.length
              ? seed.preferences.seniorityLevels
              : current.seniority,
            industry: seed.preferences?.preferredIndustries?.length
              ? seed.preferences.preferredIndustries
              : current.industry,
            relocate: seed.preferences
              ? [seed.preferences.willingToRelocate ? "Sí" : "No"]
              : current.relocate,
          }));
        } else if (seed.preferences) {
          setSelected((current) => ({
            ...current,
            roles: seed.preferences?.targetRoles?.length
              ? seed.preferences.targetRoles
              : current.roles,
            mode: seed.preferences?.modes?.length
              ? seed.preferences.modes
              : current.mode,
            employment: seed.preferences?.employmentTypes?.length
              ? seed.preferences.employmentTypes
              : current.employment,
            seniority: seed.preferences?.seniorityLevels?.length
              ? seed.preferences.seniorityLevels
              : current.seniority,
            industry: seed.preferences?.preferredIndustries?.length
              ? seed.preferences.preferredIndustries
              : current.industry,
            relocate: [seed.preferences.willingToRelocate ? "Sí" : "No"],
          }));
        }

        if (seed.preferences) {
          setSearchPreferences({
            role:
              seed.preferences.targetRoles[0] ??
              searchPreferences.role,
            location:
              seed.preferences.targetLocations[0] ??
              seed.identity.city ??
              searchPreferences.location,
            mode:
              seed.preferences.modes[0] ??
              searchPreferences.mode,
          });
          setInternationalRemote(seed.preferences.internationalRemote);
          setMinimumSalary(
            seed.preferences.minimumSalary == null
              ? ""
              : String(seed.preferences.minimumSalary),
          );
          setSalaryCurrency(seed.preferences.salaryCurrency ?? "USD");
          setSalaryPeriod(seed.preferences.salaryPeriod ?? "Mensual");
          setSkipSalary(seed.preferences.minimumSalary == null);
        }

        setSensitiveAnswers(seed.sensitiveAnswers);
        setBaseResumePath(seed.baseResumePath);
        if (seed.authorizeAutoApply) {
          setConsents((current) => [
            current[0] ?? false,
            current[1] ?? false,
            true,
          ]);
        }
      })
      .catch(() => {
        // A brand-new profile legitimately has nothing to prefill.
      })
      .finally(() => {
        if (active) setSeedLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [fetchOnboardingSeed, seedLoaded]);

  useEffect(() => {
    if (!matching) return;
    const values = [
      Math.round(matchedCount * 0.18),
      Math.round(matchedCount * 0.44),
      Math.round(matchedCount * 0.7),
      Math.round(matchedCount * 0.9),
      matchedCount,
    ];
    const timers = values.map((value, index) =>
      window.setTimeout(() => {
        setMatchStage(index);
        setCount(value);
      }, index * 520),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [matching, matchedCount]);

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
            {renderStep(step, {
              selected,
              toggle,
              name,
              setName,
              searchPreferences,
              setSearchPreferences,
              reading,
              uploadedName,
              inputRef,
              acceptFile,
              dropFile,
              consents,
              setConsents,
              profile,
              updateProfile,
              cvParsed,
              skipCv,
              sensitiveAnswers,
              setSensitiveAnswers,
              internationalRemote,
              setInternationalRemote,
              salaryCurrency,
              setSalaryCurrency,
              minimumSalary,
              setMinimumSalary,
              salaryPeriod,
              setSalaryPeriod,
              skipSalary,
              setSkipSalary,
              cvError,
            })}
          </div>
        </div>

        {saveError && <p className="px-1 pb-2 text-sm text-destructive">{saveError}</p>}
        <div className="sheet-actions">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 1 || saving}><ArrowLeft /> Atrás</Button>
          <Button type="button" className="home-primary min-w-36" onClick={() => void (step === TOTAL ? finish() : Promise.resolve(next()))} disabled={saving || (step === TOTAL && !consents.every(Boolean))}>
            {saving ? <><Loader2 className="animate-spin" /> Guardando perfil</> : <>{step === TOTAL ? "Buscar mis trabajos" : step === 4 ? "Todo correcto" : "Continuar"} <ArrowRight /></>}
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
  sensitiveAnswers: { workAuthorization: boolean | null; sponsorship: boolean | null };
  setSensitiveAnswers: (value: { workAuthorization: boolean | null; sponsorship: boolean | null }) => void;
  internationalRemote: boolean; setInternationalRemote: (value: boolean) => void;
  salaryCurrency: string; setSalaryCurrency: (value: string) => void;
  minimumSalary: string; setMinimumSalary: (value: string) => void;
  salaryPeriod: string; setSalaryPeriod: (value: string) => void;
  skipSalary: boolean; setSkipSalary: (value: boolean) => void;
  cvError: string | null;
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
    case 2: return <><p className="sheet-copy">Subí tu CV y completamos gran parte del perfil por vos.</p><input ref={p.inputRef} className="hidden" type="file" accept=".pdf,.docx" onChange={(event) => p.acceptFile(event.target.files?.[0])} /><div className="sheet-upload" role="button" tabIndex={0} onClick={() => p.inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") p.inputRef.current?.click(); }} onDragOver={(event) => event.preventDefault()} onDrop={p.dropFile}>{p.reading ? <><span className="sheet-upload-icon animate-pulse-soft"><FileText /></span><strong>Leyendo y guardando tu CV…</strong><span>{p.uploadedName}</span></> : p.uploadedName ? <><span className="sheet-upload-icon"><Check /></span><strong>{p.uploadedName}</strong><span>Completamos tu perfil con estos datos</span></> : <><span className="sheet-upload-icon"><Upload /></span><strong>Subí tu CV</strong><span>PDF o DOCX · arrastrá o elegí un archivo</span></>}</div>{p.cvError && <p className="mt-3 text-sm text-caution">{p.cvError}</p>}<Button type="button" variant="ghost" className="mt-3 w-full text-muted-foreground" onClick={p.skipCv}>Continuar sin CV</Button></>;
    case 3: return <><CvNote show={p.cvParsed} /><div className="sheet-field-grid"><Field label="Nombre"><Input value={p.cvParsed ? (p.name || p.profile.firstName) : p.name} placeholder="Sofía" onChange={(event) => p.setName(event.target.value)} /></Field><Field label="Apellido"><Input value={p.profile.lastName} placeholder="Fernández" onChange={(event) => p.updateProfile("lastName", event.target.value)} /></Field><Field label="Email"><Input type="email" value={p.profile.email} placeholder="tu@email.com" onChange={(event) => p.updateProfile("email", event.target.value)} /></Field><Field label="WhatsApp"><Input value={p.profile.phone} placeholder="+54 9 11 ..." onChange={(event) => p.updateProfile("phone", event.target.value)} /></Field><Field label="País"><SelectLike options={["Argentina", "México", "Colombia", "Chile", "Uruguay"]} value={p.profile.country} onChange={(value) => p.updateProfile("country", value)} /></Field><Field label="Ciudad"><Input value={p.profile.city || p.searchPreferences.location} placeholder="Buenos Aires" onChange={(event) => p.updateProfile("city", event.target.value)} /></Field></div></>;
    case 4: return <><p className="sheet-copy">{p.cvParsed ? "Confirmá que los datos extraídos de tu CV sean correctos. Podés editar todo." : "Contanos tu experiencia más reciente."}</p><CvNote show={p.cvParsed} /><div className="sheet-experience"><div className="sheet-field-grid"><Field label="Empresa"><Input value={p.profile.company} placeholder="Empresa" onChange={(event) => p.updateProfile("company", event.target.value)} /></Field><Field label="Puesto"><Input value={p.profile.role} placeholder="Puesto" onChange={(event) => p.updateProfile("role", event.target.value)} /></Field><Field label="Fecha de inicio"><Input value={p.profile.start} placeholder="Mar 2023" onChange={(event) => p.updateProfile("start", event.target.value)} /></Field><Field label="Fecha de fin"><Input value={p.profile.end} placeholder="Actualidad" onChange={(event) => p.updateProfile("end", event.target.value)} /></Field></div><Field label="Descripción"><Textarea value={p.profile.description} placeholder="Qué hacías en el puesto" onChange={(event) => p.updateProfile("description", event.target.value)} /></Field><Field label="Logros"><Textarea value={p.profile.achievements} placeholder="Un resultado concreto" onChange={(event) => p.updateProfile("achievements", event.target.value)} /></Field></div><AddButton>Agregar experiencia</AddButton></>;
    case 5: return <><CvNote show={p.cvParsed} /><div className="sheet-field-grid"><Field label="Institución"><Input value={p.profile.institution} placeholder="Universidad" onChange={(event) => p.updateProfile("institution", event.target.value)} /></Field><Field label="Carrera o título"><Input value={p.profile.degree} placeholder="Licenciatura" onChange={(event) => p.updateProfile("degree", event.target.value)} /></Field><Field label="Área"><Input value={p.profile.area} placeholder="Administración" onChange={(event) => p.updateProfile("area", event.target.value)} /></Field><Field label="Fechas"><Input value={p.profile.studyDates} placeholder="2018 — 2022" onChange={(event) => p.updateProfile("studyDates", event.target.value)} /></Field></div><AddButton>Agregar estudio</AddButton></>;
    case 6: return <><p className="sheet-copy">Elegí sólo habilidades que realmente puedas defender.</p><CvNote show={p.cvParsed} /><div className="relative mb-4"><Search className="sheet-field-icon" /><Input className="pl-11" placeholder="Buscar o agregar una habilidad" /></div>{chips("skills", skills)}</>;
    case 7: return <><div className="sheet-field-grid"><Field label="Idioma"><SelectLike options={["Español", "Inglés", "Portugués"]} value={p.profile.language} onChange={(value) => p.updateProfile("language", value)} /></Field><Field label="Nivel"><SelectLike options={["Básico", "Intermedio", "Avanzado", "Profesional", "Nativo"]} value={p.profile.level} onChange={(value) => p.updateProfile("level", value)} /></Field></div><AddButton>Agregar idioma</AddButton></>;
    case 8: return <><Input className="mb-4" placeholder="Buscar un puesto" />{chips("roles", ["Growth Manager", "Growth Analyst", "Product Marketing", "Business Analyst"])}<ToggleRow label="También mostrar puestos similares" /></>;
    case 9: return <><SectionLabel>Modalidad</SectionLabel>{chips("mode", ["Remoto", "Híbrido", "Presencial"])}<SectionLabel>Tipo de trabajo</SectionLabel>{chips("employment", ["Full-time", "Part-time", "Contractor", "Freelance"])}</>;
    case 10: return <><Field label="Ciudad o país"><Input value={p.searchPreferences.location} onChange={(event) => updateSearch("location", event.target.value)} placeholder="Buenos Aires, Argentina" /></Field><ToggleRow label="¿Trabajarías remoto para empresas de otros países?" checked={p.internationalRemote} onCheckedChange={p.setInternationalRemote} /><SectionLabel>¿Te mudarías por una buena oportunidad?</SectionLabel>{chips("relocate", ["Sí", "No", "Depende"])}</>;
    case 11: return <><div className="sheet-field-grid sheet-field-grid-3"><Field label="Moneda"><SelectLike options={["USD", "ARS", "MXN", "BRL"]} value={p.salaryCurrency} onChange={p.setSalaryCurrency} /></Field><Field label="Mínimo esperado"><Input inputMode="numeric" value={p.minimumSalary} disabled={p.skipSalary} placeholder="3200" onChange={(event) => p.setMinimumSalary(event.target.value.replace(/[^0-9.]/g, ""))} /></Field><Field label="Período"><SelectLike options={["Mensual", "Anual"]} value={p.salaryPeriod} onChange={p.setSalaryPeriod} /></Field></div><label className="mt-5 flex items-center gap-3 text-sm"><Checkbox checked={p.skipSalary} onCheckedChange={(checked) => p.setSkipSalary(checked === true)} /> No quiero filtrar por salario</label></>;
    case 12: return <>{chips("seniority", ["Entry level", "Junior", "Semi Senior", "Senior", "Lead", "Manager", "Director"])}<p className="sheet-help">Podés elegir niveles adyacentes.</p></>;
    case 13: return <><p className="sheet-copy">Estas respuestas salen directamente de vos. Nunca inferimos tu situación migratoria.</p><Question title="¿Tenés autorización para trabajar en Estados Unidos?" value={p.sensitiveAnswers.workAuthorization} onChange={(value) => p.setSensitiveAnswers({ ...p.sensitiveAnswers, workAuthorization: value })} /><Question title="¿Necesitarías sponsorship?" value={p.sensitiveAnswers.sponsorship} onChange={(value) => p.setSensitiveAnswers({ ...p.sensitiveAnswers, sponsorship: value })} /></>;
    case 14: return <><SectionLabel>Industrias que te gustan</SectionLabel>{chips("industry", industries.slice(0, 6))}<SectionLabel>Tamaño de empresa</SectionLabel>{chips("size", ["Startup", "Pequeña", "Mediana", "Grande"])}<SectionLabel>Condiciones que querés evitar</SectionLabel>{chips("dealbreakers", ["No trabajos a comisión", "No presencial", "No fines de semana", "No relocation", "No roles sin pago"])}<div className="mt-5 space-y-3">{[
      "La información que proporcioné es verdadera.",
      "Aplica puede reformular mi CV, pero nunca inventar experiencia, estudios o habilidades.",
      "Autorizo a Aplica a enviar las postulaciones que yo seleccione usando mi perfil y CV.",
    ].map((text, index) => <label key={text} className="sheet-consent"><Checkbox checked={p.consents[index] ?? false} onCheckedChange={() => { const next = [...p.consents]; next[index] = !next[index]; p.setConsents(next); }} /><span>{text}</span></label>)}</div></>;
    default: return null;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="sheet-field"><span>{label}</span>{children}</label>; }
function SectionLabel({ children }: { children: ReactNode }) { return <h3 className="mb-3 mt-6 text-sm font-medium first:mt-0">{children}</h3>; }
function AddButton({ children }: { children: ReactNode }) { return <Button type="button" variant="outline" size="sm" className="mt-4"><Plus />{children}</Button>; }
function SelectLike({ options, value, onChange }: { options: string[]; value?: string; onChange?: (value: string) => void }) {
  const current = value ?? "";
  return <select className="sheet-select" value={current} onChange={(event) => onChange?.(event.target.value)}>{!current && <option value="">Seleccioná una opción</option>}{options.map((option) => <option key={option}>{option}</option>)}</select>;
}
function ToggleRow({ label, checked = true, onCheckedChange }: { label: string; checked?: boolean; onCheckedChange?: (value: boolean) => void }) { return <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border pt-5"><span className="min-w-0 text-sm">{label}</span><Switch className="shrink-0" checked={checked} onCheckedChange={onCheckedChange} /></div>; }
function Question({ title, value, onChange }: { title: string; value: boolean | null; onChange: (value: boolean) => void }) { return <div className="mb-5"><p className="mb-3 text-sm font-medium">{title}</p><div className="grid grid-cols-2 gap-2"><Choice selected={value === true} onClick={() => onChange(true)}>Sí</Choice><Choice selected={value === false} onClick={() => onChange(false)}>No</Choice></div></div>; }

function Matching({ count, stage, done, onDone }: { count: number; stage: number; done: boolean; onDone: () => void }) {
  const status = ["Analizando tu perfil", "Encontrando puestos relevantes", "Comparando requisitos", "Ordenando tus mejores matches", "Listo"];
  return <div className="matching-card"><div className="matching-orbit"><span>{done ? <Check /> : count}</span></div>{done ? <><p className="sheet-kicker">Búsqueda completa</p><h2>{count === 1 ? "Encontramos 1 trabajo para vos." : `Encontramos ${count} trabajos para vos.`}</h2><p className="sheet-subtitle">{count > 0 ? "Ordenados según qué tan bien coinciden con tu experiencia y preferencias." : "Todavía no hay vacantes Auto Apply que superen tu match mínimo. Podés ajustar tus preferencias cuando quieras."}</p><Button className="home-primary mt-8 h-12 px-7" onClick={onDone}>Ver trabajos <ArrowRight /></Button></> : <><h2>Buscando oportunidades para vos</h2><div className="matching-count">{count}</div><p className="sheet-subtitle">oportunidades</p><p className="matching-status">{status[stage]}</p></>}</div>;
}