import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wordmark } from "./aplica";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  return <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
    <header className="px-6 py-5"><Wordmark compact /></header>
    <section className="mx-auto flex w-full max-w-[420px] flex-col justify-center px-5 pb-24">
      <p className="mb-3 text-sm font-medium text-primary">{signup ? "Creá tu cuenta" : "Bienvenido de vuelta"}</p>
      <h1 className="text-3xl font-medium tracking-normal">{signup ? "Empezá a buscar mejor." : "Ingresá a Aplica."}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{signup ? "Guardá tu perfil y tus oportunidades en un solo lugar." : "Continuá donde dejaste tu búsqueda laboral."}</p>
      <form className="mt-8 space-y-4" onSubmit={(event) => event.preventDefault()}>
        {signup && <label className="block text-sm font-medium">Nombre<Input className="mt-2" placeholder="Tu nombre" /></label>}
        <label className="block text-sm font-medium">Email<Input className="mt-2" type="email" placeholder="vos@email.com" /></label>
        <label className="block text-sm font-medium">Contraseña<Input className="mt-2" type="password" placeholder="••••••••" /></label>
        <Button asChild className="mt-2 w-full" size="lg"><Link to={signup ? "/onboarding" : "/jobs"}>{signup ? "Crear cuenta" : "Ingresar"}<ArrowRight /></Link></Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">{signup ? "¿Ya tenés cuenta?" : "¿Todavía no tenés cuenta?"} <Link className="font-medium text-foreground hover:text-primary" to={signup ? "/login" : "/signup"}>{signup ? "Ingresar" : "Crear cuenta"}</Link></p>
      <p className="mt-8 text-center text-xs leading-5 text-muted-foreground">Esta versión usa una sesión demostrativa. La conexión segura de cuentas se habilitará antes del lanzamiento.</p>
    </section>
  </main>;
}
