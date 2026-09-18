import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice } from "./aplica";
import { OnboardingShell } from "./onboarding-shell";
import { industries, skills } from "@/lib/aplica-data";
import { refreshJobMatches } from "@/lib/auto-apply.functions";
import { extractStructuredCv } from "@/lib/cv-extract.functions";
import {
  getOnboardingSeed,
  saveOnboardingDraft,
  saveOnboardingProfile,
  type CareerVoice,
} from "@/lib/onboarding.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TOTAL = 23;

const titles = [
  "¿Qué trabajo querés conseguir?",
  "Subí tu CV",
  "Primero, confirmemos quién sos",
  "Revisá tu experiencia laboral",
  "¿Qué hacías realmente en ese trabajo?",
  "¿Qué herramientas usabas?",
  "¿Qué resultados lograste?",
  "Mirá lo que Aplica ya entendió de vos",
  "Contanos una situación que te haya exigido",
  "¿Dónde estudiaste?",
  "¿Qué sabés hacer?",
  "¿Qué idiomas hablás?",
  "¿Qué puestos te interesan?",
  "¿Qué te gustaría hacer más?",
  "¿Qué preferís evitar?",
  "¿Cómo querés trabajar?",
  "¿Dónde trabajarías?",
  "¿Qué salario buscás?",
  "Preguntas que aparecen en postulaciones",
  "¿Qué tipo de empresa te interesa?",
  "¿Cómo querés que la IA te presente?",
  "Tu Career Profile ya tiene contexto",
  "Último paso antes de buscar trabajos",
];

type Answers = Record<string, string[]>;

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  linkedin: string;
  portfolio: string;
  company: string;
  role: string;
  start: string;
  end: string;
  description: string;
  achievements: string;
  institution: string;
  degree: string;
  area: string;
  studyDates: string;
  language: string;
  level: string;
};

type ExperienceDraft = {
  company: string;
  title: string;
  start: string;
  end: string;
  description: string;
  achievements: string;
  location: string;
  confidence: number | null;
};

type CareerContextState = {
  responsibilities: string[];
  tools: string[];
  results: string[];
  preferredTasks: string[];
  avoidTasks: string[];
  strengths: string[];
  differentiators: string[];
  proudProject: string;
  challengeStory: string;
  careerGoal: string;
  targetEnvironment: string;
  availability: string;
  travelPreference: string;
};

type WritingState = {
  voice: CareerVoice;
  emphasis: string[];
  deEmphasis: string[];
  summaryStyle: string;
};

const emptyProfile: Profile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  linkedin: "",
  portfolio: "",
  company: "",
  role: "",
  start: "",
  end: "",
  description: "",
  achievements: "",
  institution: "",
  degree: "",
  area: "",
  studyDates: "",
  language: "Español",
  level: "Nativo",
};

const emptyExperience = (): ExperienceDraft => ({
  company: "",
  title: "",
  start: "",
  end: "",
  description: "",
  achievements: "",
  location: "",
  confidence: null,
});

const emptyCareerContext: CareerContextState = {
  responsibilities: [],
  tools: [],
  results: [],
  preferredTasks: [],
  avoidTasks: [],
  strengths: [],
  differentiators: [],
  proudProject: "",
  challengeStory: "",
  careerGoal: "",
  targetEnvironment: "",
  availability: "",
  travelPreference: "",
};

const responsibilitySuggestions = [
  "Analizar datos",
  "Crear contenido",
  "Hablar con clientes",
  "Gestionar campañas",
  "Liderar proyectos",
  "Vender",
  "Programar",
  "Diseñar",
  "Automatizar procesos",
  "Investigar",
  "Reportar resultados",
  "Coordinar equipos",
];

const toolSuggestions = [
  "Excel",
  "Google Sheets",
  "SQL",
  "Python",
  "Canva",
  "Figma",
  "Notion",
  "HubSpot",
  "Salesforce",
  "Meta Ads",
  "Google Ads",
  "Google Analytics",
];

const strengthSuggestions = [
  "Resolver problemas",
  "Analizar datos",
  "Escribir",
  "Vender",
  "Hablar con clientes",
  "Organizar",
  "Negociar",
  "Aprender rápido",
  "Crear",
  "Liderar",
];

const taskSuggestions = [
  "Crear estrategia",
  "Construir cosas",
  "Analizar",
  "Trabajar con clientes",
  "Vender",
  "Escribir",
  "Investigar",
  "Gestionar proyectos",
  "Programar",
  "Diseñar",
];

export function OnboardingFlow() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [searchPreferences, setSearchPreferences] = useState({
    role: "",
    location: "",
    mode: "Remoto",
  });
  const [selected, setSelected] = useState<Answers>({
    skills: [],
    roles: [],
    mode: ["Remoto"],
    employment: ["Full-time"],
    seniority: [],
    industry: [],
    size: [],
    dealbreakers: [],
    relocate: [],
  });
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [careerContext, setCareerContext] =
    useState<CareerContextState>(emptyCareerContext);
  const [writing, setWriting] = useState<WritingState>({
    voice: "balanced",
    emphasis: ["Impacto", "Experiencia relevante"],
    deEmphasis: [],
    summaryStyle: "concise",
  });
  const [cvParsed, setCvParsed] = useState(false);
  const [uploadedName, setUploadedName] = useState("");
  const [reading, setReading] = useState(false);
  const [consents, setConsents] = useState([false, false, false]);
  const [sensitiveAnswers, setSensitiveAnswers] = useState<{
    workAuthorization: boolean | null;
    sponsorship: boolean | null;
  }>({
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
  const [factCount, setFactCount] = useState(0);
  const [seedLoaded, setSeedLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const persistOnboarding = useServerFn(saveOnboardingProfile);
  const persistDraft = useServerFn(saveOnboardingDraft);
  const fetchOnboardingSeed = useServerFn(getOnboardingSeed);
  const calculateMatches = useServerFn(refreshJobMatches);
  const structuredCvExtract = useServerFn(extractStructuredCv);

  const toggle = (group: string, value: string) =>
    setSelected((current) => ({
      ...current,
      [group]: current[group]?.includes(value)
        ? current[group].filter((item) => item !== value)
        : [...(current[group] ?? []), value],
    }));

  const toggleContext = (
    group:
      | "responsibilities"
      | "tools"
      | "preferredTasks"
      | "avoidTasks"
      | "strengths"
      | "differentiators",
    value: string,
  ) =>
    setCareerContext((current) => ({
      ...current,
      [group]: current[group].includes(value)
        ? current[group].filter((item) => item !== value)
        : [...current[group], value],
    }));

  const draftState = () => ({
    name,
    searchPreferences,
    selected,
    profile,
    experiences,
    careerContext,
    writing,
    sensitiveAnswers,
    internationalRemote,
    salaryCurrency,
    minimumSalary,
    salaryPeriod,
    skipSalary,
    baseResumePath,
    uploadedName,
    cvParsed,
    consents,
  });

  const saveDraft = async (targetStep = step) => {
    await persistDraft({
      data: { step: targetStep, state: draftState() },
    }).catch(() => undefined);
  };

  const next = async () => {
    const target = Math.min(TOTAL, step + 1);
    await saveDraft(target);
    setStep(target);
  };

  const back = async () => {
    const target = Math.max(1, step - 1);
    await saveDraft(target);
    setStep(target);
  };

  const finish = async () => {
    if (saving || !consents.every(Boolean)) return;
    setSaving(true);
    setSaveError(null);

    try {
      const targetRoles = [
        ...new Set(
          [searchPreferences.role, ...(selected.roles ?? [])]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ];
      const targetLocations = [
        searchPreferences.location || profile.city || profile.country,
      ].filter(Boolean);
      const relocate = selected.relocate?.[0] ?? "No";

      const result = await persistOnboarding({
        data: {
          identity: {
            firstName: profile.firstName.trim(),
            lastName: profile.lastName.trim(),
            email: profile.email.trim(),
            phone: profile.phone.trim(),
            country: profile.country.trim(),
            city: (profile.city || searchPreferences.location).trim(),
            currentTitle: profile.role.trim(),
          },
          links: {
            linkedin: profile.linkedin,
            portfolio: profile.portfolio,
          },
          experiences:
            experiences.length > 0
              ? experiences
                  .filter(
                    (experience) =>
                      experience.company.trim() && experience.title.trim(),
                  )
                  .map((experience) => ({
                    company: experience.company,
                    title: experience.title,
                    start: experience.start,
                    end: experience.end,
                    description: experience.description,
                    achievements: experience.achievements,
                  }))
              : profile.company.trim() && profile.role.trim()
                ? [
                    {
                      company: profile.company,
                      title: profile.role,
                      start: profile.start,
                      end: profile.end,
                      description: profile.description,
                      achievements: profile.achievements,
                    },
                  ]
                : [],
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
          careerContext,
          writingPreferences: writing,
          preferences: {
            targetRoles,
            targetLocations,
            modes: selected.mode ?? [],
            employmentTypes: selected.employment ?? [],
            seniorityLevels: selected.seniority ?? [],
            willingToRelocate: relocate === "Sí" || relocate === "Depende",
            internationalRemote,
            minimumSalary:
              skipSalary || !minimumSalary.trim()
                ? null
                : Number(minimumSalary),
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

      setFactCount(result.factCount);
      const matchResult = await calculateMatches();
      setMatchedCount(matchResult.readyCount);
      setCount(0);
      setMatching(true);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "No pudimos guardar tu perfil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (key: keyof Profile, value: string) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const syncPrimaryExperienceToProfile = (items: ExperienceDraft[]) => {
    const primary = items[0];
    if (!primary) return;
    setProfile((current) => ({
      ...current,
      company: primary.company,
      role: primary.title,
      start: primary.start,
      end: primary.end,
      description: primary.description,
      achievements: primary.achievements,
    }));
  };

  const updateExperience = (
    index: number,
    key: keyof ExperienceDraft,
    value: string,
  ) => {
    setExperiences((current) => {
      const next = current.map((experience, position) =>
        position === index ? { ...experience, [key]: value } : experience,
      );
      if (index === 0) {
        const primary = next[0];
        if (primary) {
          setProfile((profileState) => ({
            ...profileState,
            company: primary.company,
            role: primary.title,
            start: primary.start,
            end: primary.end,
            description: primary.description,
            achievements: primary.achievements,
          }));
        }
      }
      return next;
    });
  };

  const addExperience = () =>
    setExperiences((current) => {
      if (current.length) return [...current, emptyExperience()];
      const primary: ExperienceDraft = {
        company: profile.company,
        title: profile.role,
        start: profile.start,
        end: profile.end,
        description: profile.description,
        achievements: profile.achievements,
        location: "",
        confidence: null,
      };
      return [primary, emptyExperience()];
    });

  const removeExperience = (index: number) =>
    setExperiences((current) => {
      const next = current.filter((_, position) => position !== index);
      if (index === 0) syncPrimaryExperienceToProfile(next);
      return next;
    });

  const acceptFile = (file?: File) => {
    if (!file || reading) return;
    setUploadedName(file.name);
    setReading(true);
    setCvError(null);

    void (async () => {
      let fields: Partial<Profile> = {};
      let foundSkills: string[] = [];
      let parsedExperiences: ExperienceDraft[] = [];

      try {
        const { extractCvText, parseCvText } = await import("@/lib/cv-parse");
        const text = await extractCvText(file);
        const fallback = parseCvText(text);
        fields = fallback.fields as Partial<Profile>;
        foundSkills = fallback.skills;

        const structured = await structuredCvExtract({
          data: { text },
        }).catch(() => null);

        if (structured?.available && structured.extraction) {
          const extraction = structured.extraction;
          const identity = extraction.identity;

          fields = {
            ...fields,
            firstName: identity.firstName || fields.firstName,
            lastName: identity.lastName || fields.lastName,
            email: identity.email || fields.email,
            phone: identity.phone || fields.phone,
            city: identity.city || fields.city,
            country: identity.country || fields.country,
          };

          parsedExperiences = extraction.experiences.map((experience) => ({
            company: experience.company,
            title: experience.title,
            start: experience.startDate,
            end: experience.isCurrent
              ? "Actualidad"
              : experience.endDate,
            description: experience.description,
            achievements: experience.achievements.join("\n"),
            location: experience.location,
            confidence: experience.confidence,
          }));

          const primary = parsedExperiences[0];
          if (primary) {
            fields = {
              ...fields,
              company: primary.company,
              role: primary.title,
              start: primary.start,
              end: primary.end,
              description: primary.description,
              achievements: primary.achievements,
            };
          }

          const primaryEducation = extraction.education[0];
          if (primaryEducation) {
            fields = {
              ...fields,
              institution: primaryEducation.institution,
              degree: primaryEducation.degree,
              area: primaryEducation.field,
              studyDates: primaryEducation.dateRange,
            };
          }

          const firstLanguage = extraction.languages[0];
          if (firstLanguage) {
            fields = {
              ...fields,
              language: firstLanguage.language,
              level: firstLanguage.level || "Intermedio",
            };
          }

          const structuredSkills = extraction.skills
            .filter((skill) => skill.confidence >= 0.65)
            .map((skill) => skill.name)
            .filter(Boolean);
          if (structuredSkills.length) foundSkills = structuredSkills;
        } else if (fields.company && fields.role) {
          parsedExperiences = [
            {
              company: fields.company,
              title: fields.role,
              start: fields.start ?? "",
              end: fields.end ?? "",
              description: fields.description ?? "",
              achievements: fields.achievements ?? "",
              location: "",
              confidence: null,
            },
          ];
        }
      } catch (error) {
        setCvError(
          error instanceof Error ? error.message : "No pudimos leer el CV.",
        );
      }

      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("Tu sesión venció. Ingresá de nuevo.");
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .slice(-120);
        const storagePath = `${data.user.id}/base/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(storagePath, file, {
            contentType:
              file.type ||
              (file.name.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            upsert: false,
          });
        if (uploadError) throw uploadError;
        setBaseResumePath(storagePath);
      } catch (error) {
        setCvError(
          error instanceof Error
            ? `Leímos tu CV, pero no pudimos guardarlo: ${error.message}`
            : "No pudimos guardar tu CV.",
        );
      }

      const merged: Profile = {
        ...profile,
        ...fields,
        firstName: profile.firstName || fields.firstName || "",
        lastName: profile.lastName || fields.lastName || "",
        email: profile.email || fields.email || "",
        phone: profile.phone || fields.phone || "",
        country: profile.country || fields.country || "",
        city: profile.city || fields.city || "",
      };

      if (parsedExperiences.length) {
        setExperiences(parsedExperiences);
      }
      setReading(false);
      setProfile(merged);
      setCvParsed(
        parsedExperiences.length > 0 ||
          Object.values(fields).some(
            (value) =>
              typeof value === "string" && value.trim().length > 0,
          ),
      );
      if (merged.firstName) setName(merged.firstName);
      if (merged.city) {
        setSearchPreferences((current) => ({
          ...current,
          location: current.location || merged.city,
        }));
      }
      if (foundSkills.length) {
        setSelected((current) => ({
          ...current,
          skills: [...new Set(foundSkills)],
        }));
      }
      setStep(3);
    })();
  };

  const skipCv = () => {
    setCvParsed(false);
    setUploadedName("");
    setStep(3);
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

        setName(seed.identity.firstName || "");
        setProfile((current) => ({
          ...current,
          firstName: seed.identity.firstName,
          lastName: seed.identity.lastName,
          email: seed.identity.email,
          phone: seed.identity.phone,
          country: seed.identity.country,
          city: seed.identity.city,
          linkedin: seed.links.linkedin,
          portfolio: seed.links.portfolio,
          company: seed.experience?.company ?? current.company,
          role:
            seed.experience?.title ??
            seed.identity.currentTitle ??
            current.role,
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

        if (seed.experiences?.length) {
          const seededExperiences: ExperienceDraft[] = seed.experiences.map(
            (experience) => ({
              company: experience.company,
              title: experience.title,
              start: experience.start,
              end: experience.end,
              description: experience.description,
              achievements: experience.achievements,
              location: "",
              confidence: null,
            }),
          );
          setExperiences(seededExperiences);
        }

        setCareerContext({
          responsibilities: seed.careerContext.responsibilities,
          tools: seed.careerContext.tools,
          results: seed.careerContext.results,
          preferredTasks: seed.careerContext.preferredTasks,
          avoidTasks: seed.careerContext.avoidTasks,
          strengths: seed.careerContext.strengths,
          differentiators: seed.careerContext.differentiators,
          proudProject: seed.careerContext.proudProject,
          challengeStory: seed.careerContext.challengeStory,
          careerGoal: seed.careerContext.careerGoal,
          targetEnvironment: seed.careerContext.targetEnvironment,
          availability: seed.careerContext.availability,
          travelPreference: seed.careerContext.travelPreference,
        });
        setWriting(seed.writingPreferences);

        setSelected((current) => ({
          ...current,
          skills: seed.skills.length ? seed.skills : current.skills,
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

        if (seed.preferences) {
          setSearchPreferences({
            role: seed.preferences.targetRoles[0] ?? "",
            location:
              seed.preferences.targetLocations[0] ??
              seed.identity.city ??
              "",
            mode: seed.preferences.modes[0] ?? "Remoto",
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
          setConsents([true, true, true]);
        }

        const draft = seed.draft?.state;
        if (draft && typeof draft === "object" && !Array.isArray(draft)) {
          const state = draft as Record<string, unknown>;
          if (typeof state["name"] === "string") setName(state["name"]);
          if (isRecord(state["searchPreferences"])) {
            setSearchPreferences(
              state["searchPreferences"] as {
                role: string;
                location: string;
                mode: string;
              },
            );
          }
          if (isRecord(state["profile"])) {
            setProfile((current) => ({
              ...current,
              ...(state["profile"] as Partial<Profile>),
            }));
          }
          if (Array.isArray(state["experiences"])) {
            const draftExperiences = state["experiences"]
              .filter(isRecord)
              .map((experience) => ({
                ...emptyExperience(),
                ...(experience as Partial<ExperienceDraft>),
              }));
            setExperiences(draftExperiences);
          }
          if (isRecord(state["careerContext"])) {
            setCareerContext((current) => ({
              ...current,
              ...(state["careerContext"] as Partial<CareerContextState>),
            }));
          }
          if (isRecord(state["writing"])) {
            setWriting((current) => ({
              ...current,
              ...(state["writing"] as Partial<WritingState>),
            }));
          }
          if (isRecord(state["selected"])) {
            setSelected(state["selected"] as Answers);
          }
          if (isRecord(state["sensitiveAnswers"])) {
            setSensitiveAnswers(
              state["sensitiveAnswers"] as {
                workAuthorization: boolean | null;
                sponsorship: boolean | null;
              },
            );
          }
          if (typeof state["internationalRemote"] === "boolean") {
            setInternationalRemote(state["internationalRemote"]);
          }
          if (typeof state["salaryCurrency"] === "string") {
            setSalaryCurrency(state["salaryCurrency"]);
          }
          if (typeof state["minimumSalary"] === "string") {
            setMinimumSalary(state["minimumSalary"]);
          }
          if (typeof state["salaryPeriod"] === "string") {
            setSalaryPeriod(state["salaryPeriod"]);
          }
          if (typeof state["skipSalary"] === "boolean") {
            setSkipSalary(state["skipSalary"]);
          }
          if (
            typeof state["baseResumePath"] === "string" ||
            state["baseResumePath"] === null
          ) {
            setBaseResumePath(state["baseResumePath"] as string | null);
          }
          if (typeof state["uploadedName"] === "string") {
            setUploadedName(state["uploadedName"]);
          }
          if (typeof state["cvParsed"] === "boolean") {
            setCvParsed(state["cvParsed"]);
          }
          if (
            Array.isArray(state["consents"]) &&
            state["consents"].every((value) => typeof value === "boolean")
          ) {
            setConsents(state["consents"] as boolean[]);
          }
          setStep(Math.min(TOTAL, Math.max(1, seed.draft?.step ?? 1)));
        }
      })
      .catch(() => undefined)
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
      {matching ? (
        <Matching
          count={count}
          stage={matchStage}
          done={matchStage === 4}
          factCount={factCount}
          onDone={() => void navigate({ to: "/jobs" })}
        />
      ) : (
        <>
          <div className="sheet-progress">
            <span>
              Paso {step} de {TOTAL}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() =>
                void saveDraft(step).then(() => navigate({ to: "/" }))
              }
            >
              Guardar y salir
            </Button>
          </div>
          <div className="sheet-progress-track">
            <span style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>

          <div key={step} className="sheet-step">
            <h2>{titles[step - 1]}</h2>
            <div className="sheet-step-body">
              {renderStep(step, {
                selected,
                setSelected,
                toggle,
                searchPreferences,
                setSearchPreferences,
                reading,
                uploadedName,
                inputRef,
                acceptFile,
                dropFile,
                profile,
                updateProfile,
                experiences,
                updateExperience,
                addExperience,
                removeExperience,
                cvParsed,
                skipCv,
                careerContext,
                setCareerContext,
                toggleContext,
                writing,
                setWriting,
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
                consents,
                setConsents,
                cvError,
              })}
            </div>
          </div>

          {saveError && (
            <p className="px-1 pb-2 text-sm text-destructive">{saveError}</p>
          )}

          <div className="sheet-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void back()}
              disabled={step === 1 || saving}
            >
              <ArrowLeft /> Atrás
            </Button>
            <Button
              type="button"
              className="home-primary min-w-36"
              onClick={() => void (step === TOTAL ? finish() : next())}
              disabled={
                saving ||
                (step === TOTAL && !consents.every(Boolean))
              }
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" /> Guardando perfil
                </>
              ) : (
                <>
                  {step === TOTAL ? "Buscar mis trabajos" : "Continuar"}{" "}
                  <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </OnboardingShell>
  );
}

type StepProps = {
  selected: Answers;
  setSelected: React.Dispatch<React.SetStateAction<Answers>>;
  toggle: (group: string, value: string) => void;
  searchPreferences: { role: string; location: string; mode: string };
  setSearchPreferences: (value: {
    role: string;
    location: string;
    mode: string;
  }) => void;
  reading: boolean;
  uploadedName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  acceptFile: (file?: File) => void;
  dropFile: (event: DragEvent<HTMLDivElement>) => void;
  profile: Profile;
  updateProfile: (key: keyof Profile, value: string) => void;
  experiences: ExperienceDraft[];
  updateExperience: (
    index: number,
    key: keyof ExperienceDraft,
    value: string,
  ) => void;
  addExperience: () => void;
  removeExperience: (index: number) => void;
  cvParsed: boolean;
  skipCv: () => void;
  careerContext: CareerContextState;
  setCareerContext: React.Dispatch<React.SetStateAction<CareerContextState>>;
  toggleContext: (
    group:
      | "responsibilities"
      | "tools"
      | "preferredTasks"
      | "avoidTasks"
      | "strengths"
      | "differentiators",
    value: string,
  ) => void;
  writing: WritingState;
  setWriting: React.Dispatch<React.SetStateAction<WritingState>>;
  sensitiveAnswers: {
    workAuthorization: boolean | null;
    sponsorship: boolean | null;
  };
  setSensitiveAnswers: (value: {
    workAuthorization: boolean | null;
    sponsorship: boolean | null;
  }) => void;
  internationalRemote: boolean;
  setInternationalRemote: (value: boolean) => void;
  salaryCurrency: string;
  setSalaryCurrency: (value: string) => void;
  minimumSalary: string;
  setMinimumSalary: (value: string) => void;
  salaryPeriod: string;
  setSalaryPeriod: (value: string) => void;
  skipSalary: boolean;
  setSkipSalary: (value: boolean) => void;
  consents: boolean[];
  setConsents: (value: boolean[]) => void;
  cvError: string | null;
};

function renderStep(step: number, p: StepProps): ReactNode {
  const chips = (group: string, values: string[]) => (
    <div className="sheet-chips">
      {values.map((value) => (
        <Button
          type="button"
          variant="outline"
          key={value}
          onClick={() => p.toggle(group, value)}
          className={cn(
            "sheet-chip",
            p.selected[group]?.includes(value) && "sheet-chip-selected",
          )}
        >
          {value}
        </Button>
      ))}
    </div>
  );

  const contextChips = (
    group:
      | "responsibilities"
      | "tools"
      | "preferredTasks"
      | "avoidTasks"
      | "strengths"
      | "differentiators",
    values: string[],
  ) => (
    <div className="sheet-chips">
      {values.map((value) => (
        <Button
          type="button"
          variant="outline"
          key={value}
          onClick={() => p.toggleContext(group, value)}
          className={cn(
            "sheet-chip",
            p.careerContext[group].includes(value) &&
              "sheet-chip-selected",
          )}
        >
          {value}
        </Button>
      ))}
    </div>
  );

  const updateSearch = (
    key: "role" | "location" | "mode",
    value: string,
  ) =>
    p.setSearchPreferences({ ...p.searchPreferences, [key]: value });

  switch (step) {
    case 1:
      return (
        <div className="space-y-5">
          <p className="sheet-copy">
            Empezamos por el objetivo. Después vamos a conocerte mucho mejor
            que un CV tradicional.
          </p>
          <Field label="Puesto o área">
            <Input
              value={p.searchPreferences.role}
              onChange={(event) => updateSearch("role", event.target.value)}
              placeholder="Growth Manager"
            />
          </Field>
          <Field label="Ubicación">
            <Input
              value={p.searchPreferences.location}
              onChange={(event) =>
                updateSearch("location", event.target.value)
              }
              placeholder="Buenos Aires"
            />
          </Field>
          <Field label="Modalidad">
            {chips("mode", ["Remoto", "Híbrido", "Presencial"])}
          </Field>
        </div>
      );

    case 2:
      return (
        <>
          <p className="sheet-copy">
            El CV es sólo el punto de partida. Lo usamos para evitar que tengas
            que escribir de nuevo lo que ya sabemos.
          </p>
          <input
            ref={p.inputRef}
            className="hidden"
            type="file"
            accept=".pdf,.docx"
            onChange={(event) => p.acceptFile(event.target.files?.[0])}
          />
          <div
            className="sheet-upload"
            role="button"
            tabIndex={0}
            onClick={() => p.inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                p.inputRef.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={p.dropFile}
          >
            {p.reading ? (
              <>
                <span className="sheet-upload-icon animate-pulse-soft">
                  <FileText />
                </span>
                <strong>Leyendo y guardando tu CV…</strong>
                <span>{p.uploadedName}</span>
              </>
            ) : p.uploadedName ? (
              <>
                <span className="sheet-upload-icon">
                  <Check />
                </span>
                <strong>{p.uploadedName}</strong>
                <span>Lo usamos como base, pero vos confirmás los hechos.</span>
              </>
            ) : (
              <>
                <span className="sheet-upload-icon">
                  <Upload />
                </span>
                <strong>Subí tu CV</strong>
                <span>PDF o DOCX · arrastrá o elegí un archivo</span>
              </>
            )}
          </div>
          {p.cvError && (
            <p className="mt-3 text-sm text-caution">{p.cvError}</p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full text-muted-foreground"
            onClick={p.skipCv}
          >
            Continuar sin CV
          </Button>
        </>
      );

    case 3:
      return (
        <div className="space-y-5">
          <CvNote show={p.cvParsed} />
          <div className="sheet-field-grid">
            <Field label="Nombre">
              <Input
                value={p.profile.firstName}
                onChange={(event) =>
                  p.updateProfile("firstName", event.target.value)
                }
              />
            </Field>
            <Field label="Apellido">
              <Input
                value={p.profile.lastName}
                onChange={(event) =>
                  p.updateProfile("lastName", event.target.value)
                }
              />
            </Field>
          </div>
          <Field label="Email">
            <Input
              type="email"
              value={p.profile.email}
              onChange={(event) => p.updateProfile("email", event.target.value)}
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={p.profile.phone}
              onChange={(event) => p.updateProfile("phone", event.target.value)}
            />
          </Field>
          <div className="sheet-field-grid">
            <Field label="Ciudad">
              <Input
                value={p.profile.city}
                onChange={(event) => p.updateProfile("city", event.target.value)}
              />
            </Field>
            <Field label="País">
              <Input
                value={p.profile.country}
                onChange={(event) =>
                  p.updateProfile("country", event.target.value)
                }
              />
            </Field>
          </div>
          <Field label="LinkedIn (opcional)">
            <Input
              value={p.profile.linkedin}
              onChange={(event) =>
                p.updateProfile("linkedin", event.target.value)
              }
            />
          </Field>
          <Field label="Portfolio / GitHub / web (opcional)">
            <Input
              value={p.profile.portfolio}
              onChange={(event) =>
                p.updateProfile("portfolio", event.target.value)
              }
            />
          </Field>
        </div>
      );

    case 4:
      return (
        <div className="space-y-5">
          <CvNote show={p.cvParsed} />
          <p className="sheet-copy">
            Separamos cada empleo del CV. Revisalos antes de seguir: una vez que
            confirmás esta pantalla, estas experiencias pasan a ser hechos que
            Aplica puede usar para matching y CVs.
          </p>

          {(p.experiences.length
            ? p.experiences
            : [
                {
                  company: p.profile.company,
                  title: p.profile.role,
                  start: p.profile.start,
                  end: p.profile.end,
                  description: p.profile.description,
                  achievements: p.profile.achievements,
                  location: "",
                  confidence: null,
                },
              ]
          ).map((experience, index) => (
              <div
                key={index}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Experiencia {index + 1}
                    </p>
                    {experience.confidence != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Confianza de extracción:{" "}
                        {Math.round(experience.confidence * 100)}%
                      </p>
                    )}
                  </div>
                  {p.experiences.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => p.removeExperience(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar
                    </Button>
                  )}
                </div>

                <div className="sheet-field-grid">
                  <Field label="Empresa">
                    <Input
                      value={experience.company}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "company",
                              event.target.value,
                            )
                          : p.updateProfile("company", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Puesto">
                    <Input
                      value={experience.title}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "title",
                              event.target.value,
                            )
                          : p.updateProfile("role", event.target.value)
                      }
                    />
                  </Field>
                </div>

                <div className="mt-4 sheet-field-grid">
                  <Field label="Desde">
                    <Input
                      value={experience.start}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "start",
                              event.target.value,
                            )
                          : p.updateProfile("start", event.target.value)
                      }
                      placeholder="2025-03"
                    />
                  </Field>
                  <Field label="Hasta">
                    <Input
                      value={experience.end}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "end",
                              event.target.value,
                            )
                          : p.updateProfile("end", event.target.value)
                      }
                      placeholder="Actualidad"
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Responsabilidades / descripción">
                    <Textarea
                      rows={4}
                      value={experience.description}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "description",
                              event.target.value,
                            )
                          : p.updateProfile(
                              "description",
                              event.target.value,
                            )
                      }
                      placeholder="Qué hacías en este puesto."
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field label="Logros detectados">
                    <Textarea
                      rows={4}
                      value={experience.achievements}
                      onChange={(event) =>
                        p.experiences.length
                          ? p.updateExperience(
                              index,
                              "achievements",
                              event.target.value,
                            )
                          : p.updateProfile(
                              "achievements",
                              event.target.value,
                            )
                      }
                      placeholder="Un logro por línea."
                    />
                  </Field>
                </div>
              </div>
            ),
          )}

          <Button type="button" variant="outline" onClick={p.addExperience}>
            <Plus className="h-4 w-4" />
            Agregar otra experiencia
          </Button>
        </div>
      );

    case 5:
      return (
        <>
          <p className="sheet-copy">
            Elegí sólo cosas que realmente hacías. Esto le da contexto a la IA
            para escribir mejor sin inventar responsabilidades.
          </p>
          {contextChips("responsibilities", responsibilitySuggestions)}
          <ListTextarea
            label="Algo importante que no esté arriba"
            placeholder="Ej: preparaba reportes semanales para dirección"
            values={p.careerContext.responsibilities}
            onChange={(responsibilities) =>
              p.setCareerContext((current) => ({
                ...current,
                responsibilities,
              }))
            }
          />
        </>
      );

    case 6:
      return (
        <>
          <p className="sheet-copy">
            Sólo seleccioná herramientas que hayas usado de verdad.
          </p>
          {contextChips("tools", toolSuggestions)}
          <ListTextarea
            label="Otras herramientas"
            placeholder="Una por línea"
            values={p.careerContext.tools}
            onChange={(tools) =>
              p.setCareerContext((current) => ({ ...current, tools }))
            }
          />
        </>
      );

    case 7:
      return (
        <>
          <p className="sheet-copy">
            Los resultados son lo que más ayuda a transformar un CV genérico en
            uno convincente. Podés usar números o resultados cualitativos.
          </p>
          <Field label="Resultados o logros">
            <Textarea
              rows={6}
              value={p.careerContext.results.join("\n")}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  results: lines(event.target.value),
                }))
              }
              placeholder={"Ej:\nAumenté el tráfico orgánico 35%\nLancé 12 campañas\nReduje el tiempo de respuesta del equipo"}
            />
          </Field>
          <Field label="¿Hay algún proyecto del que estés especialmente orgulloso?">
            <Textarea
              value={p.careerContext.proudProject}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  proudProject: event.target.value,
                }))
              }
              placeholder="Qué hiciste vos, qué problema resolvía y qué pasó."
            />
          </Field>
        </>
      );

    case 8:
      return (
        <ProductProof
          before={
            p.profile.description ||
            p.careerContext.responsibilities[0] ||
            "Todavía no agregaste una descripción."
          }
          after={previewBullet(p)}
          note="La IA puede reformular y ordenar estos hechos para cada vacante, pero no puede agregar una habilidad, número o responsabilidad que no hayas confirmado."
        />
      );

    case 9:
      return (
        <>
          <p className="sheet-copy">
            Esto nos ayuda con preguntas como “contame un desafío” sin tener que
            inventar historias durante una aplicación.
          </p>
          <Field label="Un problema difícil que hayas resuelto">
            <Textarea
              rows={6}
              value={p.careerContext.challengeStory}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  challengeStory: event.target.value,
                }))
              }
              placeholder="Contexto → qué hiciste vos → resultado"
            />
          </Field>
        </>
      );

    case 10:
      return (
        <div className="space-y-4">
          <CvNote show={p.cvParsed} />
          <Field label="Institución">
            <Input
              value={p.profile.institution}
              onChange={(event) =>
                p.updateProfile("institution", event.target.value)
              }
            />
          </Field>
          <div className="sheet-field-grid">
            <Field label="Carrera / título">
              <Input
                value={p.profile.degree}
                onChange={(event) =>
                  p.updateProfile("degree", event.target.value)
                }
              />
            </Field>
            <Field label="Área">
              <Input
                value={p.profile.area}
                onChange={(event) => p.updateProfile("area", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Fechas">
            <Input
              value={p.profile.studyDates}
              onChange={(event) =>
                p.updateProfile("studyDates", event.target.value)
              }
              placeholder="2024 — Actualidad"
            />
          </Field>
        </div>
      );

    case 11:
      return (
        <>
          <p className="sheet-copy">
            Confirmá sólo habilidades que podrías defender en una entrevista.
          </p>
          {chips("skills", skills.slice(0, 18))}
          <ListTextarea
            label="Otras habilidades"
            placeholder="Una por línea"
            values={p.selected.skills ?? []}
            onChange={(values) =>
              p.setSelected((current) => ({
                ...current,
                skills: [...new Set(values)],
              }))
            }
            readOnlyHint="También podés elegir los chips de arriba."
          />
        </>
      );

    case 12:
      return (
        <div className="space-y-4">
          <Field label="Idioma">
            <Input
              value={p.profile.language}
              onChange={(event) =>
                p.updateProfile("language", event.target.value)
              }
            />
          </Field>
          <Field label="Nivel">
            <SelectLike
              options={[
                "Nativo",
                "Bilingüe",
                "Avanzado",
                "Intermedio",
                "Básico",
              ]}
              value={p.profile.level}
              onChange={(value) => p.updateProfile("level", value)}
            />
          </Field>
        </div>
      );

    case 13:
      return (
        <>
          <Field label="Puesto principal">
            <Input
              value={p.searchPreferences.role}
              onChange={(event) =>
                updateSearch("role", event.target.value)
              }
              placeholder="Growth Manager"
            />
          </Field>
          <SectionLabel>También me interesan</SectionLabel>
          {chips("roles", [
            "Growth Manager",
            "Growth Analyst",
            "Product Marketing",
            "Business Analyst",
            "Operations",
            "Account Executive",
          ])}
          <Field label="¿Qué querés lograr en tu próximo trabajo?">
            <Textarea
              value={p.careerContext.careerGoal}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  careerGoal: event.target.value,
                }))
              }
              placeholder="Ej: tener más ownership, trabajar en un producto global, pasar a un rol más analítico..."
            />
          </Field>
        </>
      );

    case 14:
      return (
        <>
          <p className="sheet-copy">
            Esto ayuda a distinguir dos puestos con el mismo título pero trabajo
            diario muy distinto.
          </p>
          <SectionLabel>Tareas que querés hacer más</SectionLabel>
          {contextChips("preferredTasks", taskSuggestions)}
          <SectionLabel>¿Qué sentís que hacés especialmente bien?</SectionLabel>
          {contextChips("strengths", strengthSuggestions)}
        </>
      );

    case 15:
      return (
        <>
          <p className="sheet-copy">
            Decinos qué no querés para evitar aplicar a trabajos que se ven bien
            por título pero no encajan con vos.
          </p>
          {contextChips("avoidTasks", [
            "Ventas a comisión",
            "Soporte telefónico",
            "Trabajo repetitivo",
            "Gestión de equipos",
            "Viajes frecuentes",
            "Trabajo de fin de semana",
            "Prospección en frío",
            "Guardias",
          ])}
          <SectionLabel>Condiciones que son dealbreaker</SectionLabel>
          {chips("dealbreakers", [
            "No trabajos a comisión",
            "No presencial",
            "No fines de semana",
            "No relocation",
            "No roles sin pago",
          ])}
        </>
      );

    case 16:
      return (
        <>
          <SectionLabel>Modalidad</SectionLabel>
          {chips("mode", ["Remoto", "Híbrido", "Presencial"])}
          <SectionLabel>Tipo de empleo</SectionLabel>
          {chips("employment", [
            "Full-time",
            "Part-time",
            "Contractor",
            "Internship",
          ])}
          <SectionLabel>Seniority</SectionLabel>
          {chips("seniority", [
            "Intern",
            "Junior",
            "Mid",
            "Senior",
            "Lead",
            "Manager",
            "Director",
          ])}
          <Field label="Disponibilidad">
            <Input
              value={p.careerContext.availability}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  availability: event.target.value,
                }))
              }
              placeholder="Inmediata / 2 semanas / 30 días"
            />
          </Field>
        </>
      );

    case 17:
      return (
        <>
          <Field label="Ciudad o país">
            <Input
              value={p.searchPreferences.location}
              onChange={(event) =>
                updateSearch("location", event.target.value)
              }
              placeholder="Buenos Aires, Argentina"
            />
          </Field>
          <ToggleRow
            label="¿Trabajarías remoto para empresas de otros países?"
            checked={p.internationalRemote}
            onCheckedChange={p.setInternationalRemote}
          />
          <SectionLabel>¿Te mudarías por una buena oportunidad?</SectionLabel>
          {chips("relocate", ["Sí", "No", "Depende"])}
          <Field label="Disponibilidad para viajar (opcional)">
            <Input
              value={p.careerContext.travelPreference}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  travelPreference: event.target.value,
                }))
              }
              placeholder="No / hasta 20% / ocasionalmente"
            />
          </Field>
        </>
      );

    case 18:
      return (
        <>
          <div className="sheet-field-grid sheet-field-grid-3">
            <Field label="Moneda">
              <SelectLike
                options={["USD", "ARS", "MXN", "BRL", "EUR"]}
                value={p.salaryCurrency}
                onChange={p.setSalaryCurrency}
              />
            </Field>
            <Field label="Mínimo esperado">
              <Input
                inputMode="numeric"
                value={p.minimumSalary}
                disabled={p.skipSalary}
                placeholder="3200"
                onChange={(event) =>
                  p.setMinimumSalary(
                    event.target.value.replace(/[^0-9.]/g, ""),
                  )
                }
              />
            </Field>
            <Field label="Período">
              <SelectLike
                options={["Mensual", "Anual"]}
                value={p.salaryPeriod}
                onChange={p.setSalaryPeriod}
              />
            </Field>
          </div>
          <label className="mt-5 flex items-center gap-3 text-sm">
            <Checkbox
              checked={p.skipSalary}
              onCheckedChange={(checked) =>
                p.setSkipSalary(checked === true)
              }
            />
            No quiero filtrar por salario
          </label>
        </>
      );

    case 19:
      return (
        <>
          <p className="sheet-copy">
            Nunca inferimos estas respuestas. Si no buscás trabajo en EE.UU.,
            podés dejarlas sin responder.
          </p>
          <Question
            title="¿Tenés autorización para trabajar en Estados Unidos?"
            value={p.sensitiveAnswers.workAuthorization}
            onChange={(value) =>
              p.setSensitiveAnswers({
                ...p.sensitiveAnswers,
                workAuthorization: value,
              })
            }
          />
          <Question
            title="¿Necesitarías sponsorship ahora o en el futuro?"
            value={p.sensitiveAnswers.sponsorship}
            onChange={(value) =>
              p.setSensitiveAnswers({
                ...p.sensitiveAnswers,
                sponsorship: value,
              })
            }
          />
        </>
      );

    case 20:
      return (
        <>
          <SectionLabel>Industrias que te interesan</SectionLabel>
          {chips("industry", industries.slice(0, 10))}
          <SectionLabel>Tamaño de empresa</SectionLabel>
          {chips("size", ["Startup", "Pequeña", "Mediana", "Grande"])}
          <Field label="¿En qué ambiente rendís mejor?">
            <Textarea
              value={p.careerContext.targetEnvironment}
              onChange={(event) =>
                p.setCareerContext((current) => ({
                  ...current,
                  targetEnvironment: event.target.value,
                }))
              }
              placeholder="Ej: equipo chico, mucha autonomía, producto B2B, ritmo rápido..."
            />
          </Field>
        </>
      );

    case 21:
      return (
        <>
          <p className="sheet-copy">
            Esto cambia el framing de cada CV, no los hechos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["direct", "Directo", "Claro, profesional y al punto."],
                [
                  "ambitious",
                  "Ambicioso",
                  "Destaca ownership, impacto y crecimiento.",
                ],
                [
                  "technical",
                  "Técnico",
                  "Prioriza herramientas, procesos y expertise.",
                ],
                [
                  "balanced",
                  "Equilibrado",
                  "Combina impacto, skills y responsabilidades.",
                ],
              ] as const
            ).map(([voice, title, description]) => (
              <button
                key={voice}
                type="button"
                onClick={() =>
                  p.setWriting((current) => ({ ...current, voice }))
                }
                className={cn(
                  "rounded-xl border p-4 text-left",
                  p.writing.voice === voice
                    ? "border-primary bg-selected"
                    : "border-border",
                )}
              >
                <strong className="text-sm">{title}</strong>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {description}
                </span>
              </button>
            ))}
          </div>
          <SectionLabel>Quiero que destaque</SectionLabel>
          <div className="sheet-chips">
            {["Impacto", "Ownership", "Skills", "Liderazgo", "Velocidad", "Experiencia relevante"].map(
              (value) => (
                <Button
                  type="button"
                  variant="outline"
                  key={value}
                  onClick={() =>
                    p.setWriting((current) => ({
                      ...current,
                      emphasis: current.emphasis.includes(value)
                        ? current.emphasis.filter((item) => item !== value)
                        : [...current.emphasis, value],
                    }))
                  }
                  className={cn(
                    "sheet-chip",
                    p.writing.emphasis.includes(value) &&
                      "sheet-chip-selected",
                  )}
                >
                  {value}
                </Button>
              ),
            )}
          </div>
        </>
      );

    case 22:
      return (
        <ProfileProof
          profile={p.profile}
          selected={p.selected}
          careerContext={p.careerContext}
          writing={p.writing}
        />
      );

    case 23:
      return (
        <>
          <p className="sheet-copy">
            A partir de acá Aplica puede buscar trabajos, adaptar el CV usando
            solamente hechos confirmados y preparar postulaciones para que vos
            elijas cuáles enviar.
          </p>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">Regla de la IA</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Puede mejorar redacción, jerarquía y framing. No puede inventar
              empleadores, estudios, habilidades, responsabilidades, fechas ni
              resultados.
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {[
              "La información que proporcioné es verdadera.",
              "Aplica puede reformular y endulzar mi CV usando únicamente hechos que confirmé.",
              "Autorizo a Aplica a enviar en mi nombre las postulaciones que yo seleccione.",
            ].map((text, index) => (
              <label key={text} className="sheet-consent">
                <Checkbox
                  checked={p.consents[index] ?? false}
                  onCheckedChange={() => {
                    const next = [...p.consents];
                    next[index] = !next[index];
                    p.setConsents(next);
                  }}
                />
                <span>{text}</span>
              </label>
            ))}
          </div>
        </>
      );

    default:
      return null;
  }
}

function CvNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="sheet-help mb-4 flex items-center gap-2 text-primary">
      <Check className="size-4" />
      Completado automáticamente desde tu CV. Revisalo y corregí lo que haga
      falta.
    </p>
  );
}

function ProductProof({
  before,
  after,
  note,
}: {
  before: string;
  after: string;
  note: string;
}) {
  return (
    <div>
      <p className="sheet-copy">
        Ya tenemos suficiente contexto para mejorar cómo contás esta experiencia.
      </p>
      <div className="grid gap-4">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lo que nos diste
          </p>
          <p className="mt-3 text-sm leading-6">{before}</p>
        </div>
        <div className="rounded-xl border border-primary/40 bg-selected p-4">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <Sparkles className="h-4 w-4" />
            Cómo puede estructurarlo Aplica
          </p>
          <p className="mt-3 text-sm leading-6">{after}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function ProfileProof({
  profile,
  selected,
  careerContext,
  writing,
}: {
  profile: Profile;
  selected: Answers;
  careerContext: CareerContextState;
  writing: WritingState;
}) {
  const factEstimate =
    careerContext.responsibilities.length +
    careerContext.tools.length +
    careerContext.results.length +
    careerContext.strengths.length +
    (selected.skills?.length ?? 0) +
    (profile.description ? 1 : 0) +
    (profile.achievements ? lines(profile.achievements).length : 0) +
    (careerContext.proudProject ? 1 : 0);

  return (
    <div>
      <p className="sheet-copy">
        Esto ya no es sólo tu CV. Es el contexto que Aplica usa para decidir qué
        destacar en cada puesto.
      </p>
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        <Stat label="Hechos y señales confirmadas" value={String(factEstimate)} />
        <Stat
          label="Habilidades confirmadas"
          value={String(selected.skills?.length ?? 0)}
        />
        <Stat
          label="Resultados guardados"
          value={String(careerContext.results.length)}
        />
        <Stat
          label="Estilo de CV"
          value={voiceLabel(writing.voice)}
        />
      </div>
      <div className="mt-5 rounded-xl border border-border p-4">
        <p className="text-sm font-medium">La IA puede ahora:</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>✓ elegir qué experiencia priorizar según la vacante</li>
          <li>✓ reescribir bullets sin cambiar los hechos</li>
          <li>✓ adaptar el resumen profesional al rol</li>
          <li>✓ responder preguntas usando historias que vos confirmaste</li>
        </ul>
      </div>
    </div>
  );
}

function Matching({
  count,
  stage,
  done,
  factCount,
  onDone,
}: {
  count: number;
  stage: number;
  done: boolean;
  factCount: number;
  onDone: () => void;
}) {
  const status = [
    "Analizando tu Career Profile",
    "Encontrando puestos relevantes",
    "Comparando requisitos",
    "Revisando qué formularios podemos completar",
    "Listo",
  ];
  return (
    <div className="matching-card">
      <div className="matching-orbit">
        <span>{done ? <Check /> : count}</span>
      </div>
      {done ? (
        <>
          <p className="sheet-kicker">Búsqueda completa</p>
          <h2>
            {count === 1
              ? "Encontramos 1 trabajo listo para aplicar."
              : `Encontramos ${count} trabajos listos para aplicar.`}
          </h2>
          <p className="sheet-subtitle">
            {factCount > 0
              ? `Tu perfil quedó construido con ${factCount} hechos confirmados que la IA puede usar sin inventar.`
              : "Tu perfil y tus preferencias ya están guardados."}
          </p>
          <Button
            className="home-primary mt-8 h-12 px-7"
            onClick={onDone}
          >
            Ver trabajos <ArrowRight />
          </Button>
        </>
      ) : (
        <>
          <h2>Buscando oportunidades para vos</h2>
          <div className="matching-count">{count}</div>
          <p className="sheet-subtitle">listas para aplicar</p>
          <p className="matching-status">{status[stage]}</p>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 mt-6 text-sm font-medium first:mt-0">{children}</p>
  );
}

function Question({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mb-5">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <Choice selected={value === true} onClick={() => onChange(true)}>
          Sí
        </Choice>
        <Choice selected={value === false} onClick={() => onChange(false)}>
          No
        </Choice>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border pt-5">
      <span className="min-w-0 text-sm">{label}</span>
      <Switch
        className="shrink-0"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function SelectLike({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="sheet-select w-full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function ListTextarea({
  label,
  placeholder,
  values,
  onChange,
  readOnlyHint,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  readOnlyHint?: string;
}) {
  return (
    <Field label={label}>
      <Textarea
        rows={4}
        placeholder={placeholder}
        value={values.join("\n")}
        onChange={(event) => onChange(lines(event.target.value))}
      />
      {readOnlyHint && (
        <p className="mt-2 text-xs text-muted-foreground">{readOnlyHint}</p>
      )}
    </Field>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-medium">{value}</p>
    </div>
  );
}

function previewBullet(p: StepProps) {
  const responsibility =
    p.careerContext.responsibilities[0] || p.profile.description;
  const tools = p.careerContext.tools.slice(0, 2).join(" y ");
  const result =
    p.careerContext.results[0] ||
    lines(p.profile.achievements)[0] ||
    "";

  const pieces = [
    responsibility
      ? sentenceCase(responsibility)
      : "Experiencia relevante confirmada por el usuario",
    tools ? `usando ${tools}` : "",
    result ? `con un resultado confirmado: ${result}` : "",
  ].filter(Boolean);

  return pieces.join(", ") + ".";
}

function voiceLabel(voice: CareerVoice) {
  return {
    direct: "Directo",
    ambitious: "Ambicioso",
    technical: "Técnico",
    balanced: "Equilibrado",
  }[voice];
}

function sentenceCase(value: string) {
  const cleanValue = value.trim().replace(/[.]+$/, "");
  if (!cleanValue) return "";
  return cleanValue[0].toUpperCase() + cleanValue.slice(1);
}

function lines(value: string) {
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
