import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wordmark } from "./aplica";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true); setMessage(null);
    try {
      const response = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { first_name: name.trim() }, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}onboarding` } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (response.error) throw response.error;
      if (!response.data.session) { setMessage("Revisá tu email para confirmar la cuenta y después ingresá."); return; }
      await router.invalidate();
      await navigate({ to: signup || window.localStorage.getItem("aplica-profile-draft-v1") ? "/onboarding" : "/jobs" });
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos ingresar. Intentá nuevamente."); }
    finally { setPending(false); }
  };
  return <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
    <header className="px-6 py-5"><Wordmark compact /></header>
    <section className="mx-auto flex w-full max-w-[420px] flex-col justify-center px-5 pb-24">
      <p className="mb-3 text-sm font-medium text-primary">{signup ? "Creá tu cuenta" : "Bienvenido de vuelta"}</p>
      <h1 className="text-3xl font-medium tracking-normal">{signup ? "Empezá a buscar mejor." : "Ingresá a Aplica."}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{signup ? "Guardá tu perfil y tus oportunidades en un solo lugar." : "Continuá donde dejaste tu búsqueda laboral."}</p>
      <form className="mt-8 space-y-4" onSubmit={(event) => void submit(event)}>
        {signup && <label className="block text-sm font-medium">Nombre<Input className="mt-2" placeholder="Tu nombre" autoComplete="given-name" value={name} onChange={(event) => setName(event.target.value)} required /></label>}
        <label className="block text-sm font-medium">Email<Input className="mt-2" type="email" placeholder="vos@email.com" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label className="block text-sm font-medium">Contraseña<Input className="mt-2" type="password" placeholder="••••••••" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : 1} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        <Button type="submit" disabled={pending} className="mt-2 w-full" size="lg">{pending ? "Conectando…" : signup ? "Crear cuenta" : "Ingresar"}<ArrowRight /></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{signup ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"} <Link className="font-medium text-foreground hover:text-primary" to={signup ? "/login" : "/signup"}>{signup ? "Ingresar" : "Crear cuenta"}</Link></p>
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Tu perfil y tus postulaciones se guardan en tu cuenta.</p>
    </section>
  </main>;
}
