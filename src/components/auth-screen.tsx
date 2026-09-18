import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "./aplica";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);

    try {
      if (signup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              first_name: name.trim() || undefined,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setNotice("Te enviamos un email para confirmar tu cuenta. Después ingresá para continuar.");
          return;
        }

        await navigate({ to: "/onboarding" });
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      await navigate({ to: "/jobs" });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No pudimos completar la operación.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
      <header className="px-6 py-5"><Wordmark compact /></header>
      <section className="mx-auto flex w-full max-w-[420px] flex-col justify-center px-5 pb-24">
        <p className="mb-3 text-sm font-medium text-primary">{signup ? "Creá tu cuenta" : "Bienvenido de vuelta"}</p>
        <h1 className="text-3xl font-medium tracking-normal">{signup ? "Empezá a buscar mejor." : "Ingresá a Aplica."}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {signup ? "Guardá tu perfil y tus oportunidades en un solo lugar." : "Continuá donde dejaste tu búsqueda laboral."}
        </p>

        <form className="mt-8 space-y-4" onSubmit={submit}>
          {signup && (
            <label className="block text-sm font-medium">
              Nombre
              <Input
                className="mt-2"
                autoComplete="given-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
              />
            </label>
          )}
          <label className="block text-sm font-medium">
            Email
            <Input
              className="mt-2"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vos@email.com"
            />
          </label>
          <label className="block text-sm font-medium">
            Contraseña
            <Input
              className="mt-2"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && <p className="rounded-lg border border-border bg-surface p-3 text-sm leading-6 text-muted-foreground">{notice}</p>}

          <Button className="mt-2 w-full" size="lg" type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {signup ? "Crear cuenta" : "Ingresar"}
            {!pending && <ArrowRight />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {signup ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"}{" "}
          <Link className="font-medium text-foreground hover:text-primary" to={signup ? "/login" : "/signup"}>
            {signup ? "Ingresar" : "Crear cuenta"}
          </Link>
        </p>
        <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">
          Tu sesión se maneja con Supabase Auth. Aplica nunca guarda tu contraseña.
        </p>
      </section>
    </main>
  );
}
