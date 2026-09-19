import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { jobs as initialJobs, type Job } from "./aplica-data";

interface AplicaState {
  jobs: Job[];
  onboardingStep: number;
  onboardingComplete: boolean;
  subscribed: boolean;
  name: string;
  searchPreferences: { role: string; location: string; mode: string };
  setName: (value: string) => void;
  setSearchPreferences: (value: { role: string; location: string; mode: string }) => void;
  setOnboardingStep: (value: number) => void;
  completeOnboarding: () => void;
  toggleJob: (id: string) => void;
  toggleSaved: (id: string) => void;
  selectEligible: (selected: boolean) => void;
  choosePlan: () => void;
}

const AplicaContext = createContext<AplicaState | undefined>(undefined);
const STORAGE_KEY = "aplica-demo-state";

export function AplicaProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [name, setName] = useState("Sofía");
  const [searchPreferences, setSearchPreferences] = useState({ role: "", location: "", mode: "Remoto" });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<{ onboardingStep: number; onboardingComplete: boolean; subscribed: boolean; name: string; searchPreferences: { role: string; location: string; mode: string }; selectedIds: string[]; savedIds: string[] }>;
      if (saved.onboardingStep) setOnboardingStep(saved.onboardingStep);
      if (typeof saved.onboardingComplete === "boolean") setOnboardingComplete(saved.onboardingComplete);
      if (typeof saved.subscribed === "boolean") setSubscribed(saved.subscribed);
      if (saved.name) setName(saved.name);
      if (saved.searchPreferences) setSearchPreferences(saved.searchPreferences);
      setJobs((current) => current.map((job) => ({ ...job, selected: saved.selectedIds?.includes(job.id) ?? job.selected, saved: saved.savedIds?.includes(job.id) ?? job.saved })));
    } catch { /* ignore invalid demo state */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ onboardingStep, onboardingComplete, subscribed, name, searchPreferences, selectedIds: jobs.filter((job) => job.selected).map((job) => job.id), savedIds: jobs.filter((job) => job.saved).map((job) => job.id) }));
  }, [jobs, onboardingStep, onboardingComplete, subscribed, name, searchPreferences]);

  const value = useMemo<AplicaState>(() => ({
    jobs, onboardingStep, onboardingComplete, subscribed, name, searchPreferences, setName, setSearchPreferences, setOnboardingStep,
    completeOnboarding: () => setOnboardingComplete(true),
    toggleJob: (id) => setJobs((current) => current.map((job) => job.id === id ? { ...job, selected: !job.selected } : job)),
    toggleSaved: (id) => setJobs((current) => current.map((job) => job.id === id ? { ...job, saved: !job.saved } : job)),
    selectEligible: (selected) => setJobs((current) => current.map((job) => ({ ...job, selected: job.match >= 80 ? selected : false }))),
    choosePlan: () => setSubscribed(true),
  }), [jobs, onboardingStep, onboardingComplete, subscribed, name, searchPreferences]);

  return <AplicaContext.Provider value={value}>{children}</AplicaContext.Provider>;
}

export function useAplica() {
  const context = useContext(AplicaContext);
  if (!context) throw new Error("useAplica debe usarse dentro de AplicaProvider");
  return context;
}
