export type MatchTier = "Excelente match" | "Muy buen match" | "Buen match";
export type ApplicationStatus = "Enviada" | "Necesita atención" | "Entrevista" | "Rechazada" | "Archivada";

export interface Job {
  id: string;
  role: string;
  company: string;
  initials: string;
  location: string;
  mode: string;
  salary: string;
  posted: string;
  match: number;
  fit: string[];
  concern?: string;
  description: string;
  requirements: string[];
  selected: boolean;
  saved: boolean;
}

export interface Application {
  id: string;
  role: string;
  company: string;
  initials: string;
  date: string;
  cv: string;
  status: ApplicationStatus;
  match: number;
  source: string;
}

export const jobs: Job[] = [
  { id: "ramp-growth", role: "Growth Manager", company: "Ramp", initials: "RA", location: "Nueva York", mode: "Remoto", salary: "USD 110k–150k", posted: "Hace 2 días", match: 94, fit: ["Experiencia en growth", "B2B SaaS", "Compatible con remoto", "Español + inglés"], concern: "Piden 2+ años en B2B; tu perfil muestra 1 año y 8 meses.", description: "Liderá experimentos de adquisición y activación para uno de los equipos de producto de mayor crecimiento de Ramp.", requirements: ["3+ años en growth o producto", "Experiencia con SQL y analytics", "Inglés profesional"], selected: true, saved: false },
  { id: "meli-growth", role: "Growth Strategy Analyst", company: "Mercado Libre", initials: "ML", location: "Buenos Aires", mode: "Híbrido", salary: "USD 3.200–4.500/mes", posted: "Hoy", match: 91, fit: ["Análisis de funnels", "Mercado LATAM", "SQL + Excel", "Seniority compatible"], description: "Analizá oportunidades de crecimiento y trabajá con equipos regionales para mejorar la experiencia de millones de usuarios.", requirements: ["Pensamiento analítico", "SQL intermedio", "Experiencia en negocios digitales"], selected: true, saved: true },
  { id: "stripe-marketing", role: "Product Marketing Associate", company: "Stripe", initials: "ST", location: "Ciudad de México", mode: "Remoto", salary: "USD 72k–96k", posted: "Hace 1 día", match: 88, fit: ["Go-to-market", "Fintech", "Inglés profesional", "Trabajo remoto"], concern: "La experiencia fintech es preferida, no excluyente.", description: "Ayudá a llevar nuevos productos al mercado y convertí necesidades complejas en mensajes simples.", requirements: ["2+ años en marketing", "Excelente comunicación", "Inglés avanzado"], selected: true, saved: false },
  { id: "notco-performance", role: "Performance Marketing Lead", company: "NotCo", initials: "NC", location: "Santiago", mode: "Híbrido", salary: "USD 3.800–5.200/mes", posted: "Hace 3 días", match: 84, fit: ["Meta Ads", "Consumer", "Gestión de presupuesto", "Liderazgo"], description: "Diseñá y ejecutá la estrategia de adquisición paga para mercados clave de América Latina.", requirements: ["Meta y Google Ads", "Gestión de agencias", "Análisis de cohortes"], selected: true, saved: false },
  { id: "canva-lifecycle", role: "Lifecycle Marketing Specialist", company: "Canva", initials: "CA", location: "Latinoamérica", mode: "Remoto", salary: "USD 58k–78k", posted: "Hace 4 días", match: 81, fit: ["CRM y lifecycle", "Producto digital", "Remoto global"], concern: "Piden experiencia con Braze; declaraste experiencia con herramientas similares.", description: "Creá experiencias de comunicación que acompañen a usuarios durante todo su ciclo de vida.", requirements: ["CRM o lifecycle", "Experimentación A/B", "Inglés profesional"], selected: true, saved: false },
  { id: "uala-analyst", role: "Marketing Analytics Specialist", company: "Ualá", initials: "UA", location: "Buenos Aires", mode: "Híbrido", salary: "USD 2.800–3.900/mes", posted: "Hace 5 días", match: 78, fit: ["SQL", "Dashboards", "Fintech LATAM"], concern: "El rol requiere presencialidad dos veces por semana.", description: "Transformá datos de marketing en decisiones claras para equipos de adquisición y producto.", requirements: ["SQL avanzado", "Looker o Tableau", "3+ años de experiencia"], selected: false, saved: false },
];

export const applications: Application[] = [
  { id: "a1", role: "Growth Analyst", company: "Pomelo", initials: "PO", date: "15 sep", cv: "CV · Growth.pdf", status: "Enviada", match: 90, source: "LinkedIn" },
  { id: "a2", role: "Growth Associate", company: "Ramp", initials: "RA", date: "14 sep", cv: "CV · Growth.pdf", status: "Necesita atención", match: 94, source: "Greenhouse" },
  { id: "a3", role: "Marketing Analyst", company: "Kavak", initials: "KA", date: "11 sep", cv: "CV · Marketing.pdf", status: "Entrevista", match: 86, source: "Lever" },
  { id: "a4", role: "Lifecycle Specialist", company: "Rappi", initials: "RP", date: "8 sep", cv: "CV · Lifecycle.pdf", status: "Rechazada", match: 79, source: "Workday" },
];

export function matchTier(score: number): MatchTier {
  if (score >= 90) return "Excelente match";
  if (score >= 80) return "Muy buen match";
  return "Buen match";
}

export const skills = ["Marketing", "Python", "Excel", "Sales", "SQL", "Meta Ads", "Figma", "React", "Análisis financiero", "Gestión de proyectos"];
export const industries = ["Tecnología", "Finanzas", "Salud", "Retail", "Agro", "Consultoría", "Medios", "Gaming", "Inteligencia artificial", "Consumo"];
