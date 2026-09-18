# Aplica Career Companion

Build a production-quality responsive web application called Aplica.

Domain: aplica.lat

Aplica is a consumer job-search product for Latin America.

The core promise:

Subí tu CV. Encontramos los trabajos correctos y aplicamos por vos.

The product should feel extremely simple to the user even though the automation behind it is complex.

This is NOT a generic SaaS dashboard.
This is NOT an AI chatbot product.
This should feel like a premium consumer search/productivity product.

Think closer to a beautifully designed travel search engine, Linear-level product polish, or a premium consumer fintech product.

The entire experience must be in Spanish LATAM, but architect the copy so English and Portuguese can be added later through i18n.

BRAND

Brand name:

aplica

Always render the wordmark lowercase:

aplica

Primary domain:

aplica.lat

Do not create a complicated logo.

Use a clean lowercase typographic wordmark.

Potential wordmark treatment:

aplica.

or simply:

aplica

The product should feel:

calm

premium

confident

fast

simple

trustworthy

consumer-first

It should NOT feel:

corporate HR software

recruiter software

crypto

generic AI SaaS

futuristic

childish

overly gamified

DESIGN SYSTEM

This is extremely important.

DO NOT make the interface look like a typical Lovable-generated SaaS.

STRICTLY AVOID:

purple gradients

blue-purple gradients

glassmorphism

glowing cards

giant rounded cards everywhere

bento grids

gradient text

AI robot illustrations

sparkles

magic wand icons

brain icons

rocket icons

“Powered by AI” badges

giant hero illustrations

generic 3-column features sections

excessive shadows

giant dashboard sidebars

fake testimonials

fake company logos

fake user counts

fake success statistics

Do not overuse cards.

Whitespace is part of the design.

COLORS

Main background:

#FFFFFF

Primary text:

#111111

Secondary text:

#6B6B6B

Borders:

#E7E7E7

Very light surfaces:

#F7F7F5

Primary action color:

Use one distinctive saturated blue.

Suggested:

#2563EB

Use blue sparingly.

It should mainly indicate:

primary CTA

selected elements

progress

match score accents

interactive links

TYPOGRAPHY

Use a clean neutral sans-serif.

Prefer something visually similar to:

Inter
Geist
Söhne
Helvetica Neue

Do not make every headline huge.

Main heading desktop:

48–64px maximum.

Body:

16–18px.

Navigation:

14–15px.

Use medium weight more often than bold.

Avoid marketing-style exaggerated typography.

BORDER RADIUS

Inputs:
10px

Buttons:
10–12px

Small pills:
999px

Large containers:
12–16px maximum

Do not use giant 30px rounded cards.

HOMEPAGE

Route:

/

Top navigation.

Left:

aplica

Right:

Cómo funciona

Ingresar

Primary small CTA:

Empezar

Keep navigation minimal.

No giant navbar.

Main hero should have enormous whitespace.

Centered content.

Small eyebrow:

Tu búsqueda laboral, automatizada.

Main H1:

Encontrar trabajo no debería ser un trabajo.

Subheadline:

Subí tu CV y Aplica encuentra los puestos que mejor encajan con vos, adapta tu perfil y te ayuda a postularte sin repetir el mismo formulario cien veces.

Main CTA:

Encontrar trabajos

Secondary subtle text link:

Ya tengo cuenta

Under the CTA show very subtle trust copy:

Tu experiencia sigue siendo tuya. Nunca inventamos información en tu CV.

Do NOT immediately show pricing.

Do NOT put ten sections underneath.

The homepage should transition into the product quickly.

START FLOW

When the user clicks:

Encontrar trabajos

route to:

/onboarding

The onboarding should feel like an interactive product, not a giant form.

ONE main question per screen whenever possible.

Top left:

aplica

Top center or below logo:

thin progress indicator

Top right:

Guardar y salir

Use beautiful page transitions.

150–250ms.

No flashy animations.

ONBOARDING STEP 1

Headline:

Empecemos por vos.

Fields:

Nombre

Apellido

Email

WhatsApp

Country selector

CTA:

Continuar

Under WhatsApp:

Te avisaremos cuando encontremos nuevos trabajos o una aplicación necesite tu atención.

STEP 2 — CV

Headline:

Subí tu CV

Subtext:

Lo usamos para completar tu perfil y encontrar oportunidades compatibles.

Large but minimalist upload area.

Accept:

PDF
DOCX

CTA:

Subir CV

Secondary:

Continuar sin CV

When uploaded:

show filename

then an animated state:

Leyendo tu experiencia...

Do not call this “AI processing”.

Then:

Listo. Encontramos tu experiencia.

CTA:

Revisar perfil

STEP 3 — EXPERIENCE REVIEW

Automatically populate experience extracted from CV.

Each experience:

Company

Job title

Start date

End date

Current position toggle

Description

Achievements

Allow editing.

Button:

Agregar experiencia

Important:

The system must NEVER invent:

employers

titles

employment dates

degrees

certifications

skills

metrics

achievements

It may later rephrase existing information, but source facts must remain truthful.

CTA:

Todo correcto

STEP 4 — EDUCATION

Headline:

¿Dónde estudiaste?

For each education entry:

Institution

Degree

Field of study

Start year

End year

Currently studying toggle

Button:

Agregar estudio

CTA:

Continuar

Allow skipping if appropriate.

STEP 5 — SKILLS

Headline:

¿Qué sabés hacer?

Prepopulate from CV.

Use searchable chips.

Examples:

Marketing
Python
Excel
Sales
SQL
Meta Ads
Figma
React
Financial analysis
Project management

Allow users to add skills.

Subtext:

Elegí sólo habilidades que realmente puedas defender en una entrevista.

CTA:

Continuar

STEP 6 — LANGUAGES

Headline:

¿Qué idiomas hablás?

Language

Level:

Básico
Intermedio
Avanzado
Profesional
Nativo

CTA:

Continuar

STEP 7 — TARGET ROLE

Headline:

¿Qué trabajo estás buscando?

Main search input.

Example placeholder:

Growth Manager, Software Engineer, Analista financiero...

Allow multiple target roles.

Maximum suggested:

5

Below:

También me interesan puestos similares

toggle enabled by default.

CTA:

Continuar

STEP 8 — SENIORITY

Headline:

¿Qué nivel de puesto buscás?

Options:

Pasantía

Entry level

Junior

Semi Senior

Senior

Lead

Manager

Director

Executive

Allow selecting multiple adjacent options.

CTA:

Continuar

STEP 9 — LOCATION

Headline:

¿Dónde querés trabajar?

Location search.

Then:

¿Cómo querés trabajar?

Selectable:

Remoto

Híbrido

Presencial

Allow multiple.

Then:

¿Trabajarías para una empresa de otro país de forma remota?

Sí

No

CTA:

Continuar

STEP 10 — RELOCATION

Headline:

¿Te mudarías por el trabajo correcto?

Options:

Sí

No

Depende de la oportunidad

If yes:

select countries or cities.

CTA:

Continuar

STEP 11 — EMPLOYMENT TYPE

Headline:

¿Qué tipo de trabajo buscás?

Full-time

Part-time

Contractor

Freelance

Internship

Temporary

Allow multiple.

CTA:

Continuar

STEP 12 — SALARY

Headline:

¿Cuánto te gustaría ganar?

Currency dropdown.

Minimum desired compensation.

Optional preferred compensation.

Period:

Monthly
Annual
Hourly

Toggle:

Prefiero no filtrar trabajos por salario

Explain:

Sólo usaremos este dato para evitar oportunidades que estén claramente por debajo de lo que buscás.

CTA:

Continuar

STEP 13 — WORK AUTHORIZATION

Headline:

Unas preguntas que suelen aparecer al postularte

Ask dynamically based on selected countries.

Examples:

¿Tenés autorización legal para trabajar en Estados Unidos?

¿Necesitás sponsorship ahora o en el futuro?

These answers must ALWAYS come directly from user input.

Never infer or fabricate immigration status.

CTA:

Continuar

STEP 14 — AVAILABILITY

Headline:

¿Cuándo podrías empezar?

Immediately

1–2 weeks

2–4 weeks

1–2 months

Custom

CTA:

Continuar

STEP 15 — COMPANY PREFERENCES

Headline:

¿Dónde te gustaría trabajar?

Company size:

Startup

Small company

Medium company

Large company

No preference

Industries interested in.

Examples:

Technology
Finance
Healthcare
Retail
Agriculture
Consulting
Media
Gaming
AI
Consumer

Allow:

No tengo preferencia

CTA:

Continuar

STEP 16 — DEALBREAKERS

Headline:

¿Hay trabajos que querés evitar?

Choices:

Commission-only

Night shift

Weekend work

Relocation required

Travel required

Unpaid internships

Contractor roles

On-site only

Add custom preference.

CTA:

Continuar

STEP 17 — LINKS

Headline:

Agregá tus perfiles profesionales

Optional fields:

LinkedIn

GitHub

Portfolio

Behance

Personal website

CTA:

Continuar

STEP 18 — PHOTO

Headline:

Foto de perfil

Clearly mark it:

Opcional

Upload photo.

Explain:

No necesitamos una foto para encontrar trabajos. Sólo la usaremos si vos decidís incluirla en algún perfil o aplicación.

CTA:

Continuar

Also offer:

Omitir

STEP 19 — APPLICATION QUESTIONS

Headline:

Ayudanos a responder aplicaciones por vos

Explain:

Estas respuestas aparecen una y otra vez en formularios de empleo. Si las respondés una vez, no vas a tener que hacerlo cien veces.

Ask:

Why are you looking for a new role?

What type of role interests you most?

What are your strongest skills?

Describe one professional achievement.

Are you comfortable traveling for work?

How much travel?

Do you have a driver's license?

Are you willing to undergo a background check?

Years of experience in selected core skills.

For subjective written answers:

allow:

Responder después

Do not force every field.

STEP 20 — APPLICATION BEHAVIOR

Headline:

¿Cómo querés que Aplica trabaje por vos?

Option A:

Automático

Aplica automáticamente cuando encontramos un trabajo que cumple tus criterios.

Option B:

Con revisión

Te mostramos las oportunidades antes de enviar cada aplicación.

Default:

Con revisión.

Below:

Siempre te pediremos ayuda si encontramos una pregunta que no podemos responder con seguridad.

CTA:

Continuar

STEP 21 — TRUTH AND CONSENT

Headline:

Una última cosa

Use a simple clean checklist.

User confirms:

☐ La información que proporcioné es verdadera.

☐ Autorizo a Aplica a utilizar estos datos para completar aplicaciones laborales que yo seleccione o autorice.

☐ Entiendo que Aplica puede reformular mi CV, pero nunca debe inventar experiencia, estudios o habilidades.

CTA:

Encontrar mis trabajos

MATCHING LOADING EXPERIENCE

Do not immediately jump into results.

Create a premium animated sequence.

White background.

Centered.

First:

Buscando oportunidades para vos...

Then animate text:

Analizando tu experiencia

Comparando requisitos

Descartando trabajos irrelevantes

Ordenando tus mejores oportunidades

Show numbers appearing dynamically:

21 trabajos encontrados

48

76

103

127

Do not make the sequence longer than several seconds.

Then:

Encontramos 127 oportunidades para vos.

CTA:

Ver mis trabajos

JOB MATCH RESULTS

Route:

/jobs

This is the WOW moment.

Header:

aplica

Middle tabs:

Trabajos

Aplicaciones

Perfil

Right:

avatar

Main heading:

127 trabajos para vos

Subheadline:

Ordenados según qué tan bien coincide tu perfil con cada puesto.

IMPORTANT:

Do NOT say:

“92% chance of getting hired.”

Instead say:

92% match

This is a relevance score, not a hiring probability.

Tooltip:

El match compara tu experiencia, habilidades, ubicación y preferencias con los requisitos del puesto. No representa una probabilidad de contratación.

JOB RESULT DESIGN

Avoid huge cards.

Make rows visually similar to premium search results.

Example:

[company logo]

Growth Manager

Ramp

New York · Remote

$110k–$150k

Posted 2d ago

Right side:

94% match

Below:

Por qué encaja con vos

✓ Growth experience

✓ B2B SaaS

✓ Remote compatible

✓ Spanish + English

Potential concern:

2+ years requested

User has 1.5 years

Buttons:

Ver trabajo

small secondary icon:

save

Sort jobs from highest match to lowest match.

Match tiers:

90–100

Excelente match

80–89

Muy buen match

70–79

Buen match

Do not show jobs under a configurable minimum by default.

MATCHING MODEL UI

The percentage should consider:

Target role similarity

Relevant work experience

Skills

Seniority

Education if explicitly required

Language requirements

Location

Remote preference

Work authorization

Salary

Industry preference

Employment type

Hard requirements should heavily influence score.

Do not present this as a scientifically exact probability.

STICKY MASS APPLY CTA

At the bottom of job results create a premium sticky action bar.

Left:

120 trabajos cumplen tus criterios

Right primary CTA:

Aplicar a 120 trabajos

Small subcopy:

CV adaptado para cada puesto

The number must be DYNAMIC.

Examples:

Aplicar a 24 trabajos

Aplicar a 87 trabajos

Aplicar a 120 trabajos

Never hardcode 120.

HARD PAYWALL

The first time the user clicks mass apply:

open:

/upgrade

This must be a HARD PAYWALL.

Do not allow submitting applications before subscription.

The important psychological sequence is:

user invested in completing profile

user sees actual matching jobs

user sees how many jobs Aplica can handle

only THEN show pricing

Do not place paywall before job results.

PAYWALL DESIGN

Extremely clean.

No SaaS pricing-table ugliness.

Heading:

Dejá de aplicar trabajo por trabajo.

Subheading:

Aplica adapta tu CV, completa las postulaciones y mantiene todo organizado por vos.

Show personalized value:

Encontramos 120 trabajos listos para aplicar con tu perfil.

Then plans.

PLAN 1

Starter

USD 6.99 / semana

25 aplicaciones por semana

Includes:

✓ búsqueda automática de trabajos

✓ adaptación de CV

✓ autocompletado de aplicaciones

✓ seguimiento de postulaciones

CTA:

Elegir Starter

PLAN 2

Highlight as:

Más elegido

Name:

Pro

USD 11.99 / semana

100 aplicaciones por semana

Includes:

✓ todo en Starter

✓ 100 aplicaciones semanales

✓ CV personalizado para cada trabajo

✓ respuestas personalizadas

✓ notificaciones por WhatsApp

CTA:

Empezar con Pro

Make this visually preferred but not obnoxious.

PLAN 3

Max

USD 17.99 / semana

250 aplicaciones por semana

Includes:

✓ todo en Pro

✓ 250 aplicaciones por semana

✓ búsqueda prioritaria

✓ más ubicaciones y roles simultáneos

CTA:

Elegir Max

Under plans:

Cancelá cuando quieras.

And:

Nunca agregamos experiencia, estudios ni habilidades que no hayas declarado.

Do not use dark patterns.

Show recurring billing clearly.

POST PAYMENT

After successful payment:

route back to job selection.

Headline:

Elegí dónde querés aplicar

All jobs with match score.

Default select only high-quality matches.

Do NOT automatically select jobs violating dealbreakers.

Buttons:

Select all eligible

Deselect all

Then:

Aplicar a 87 trabajos

APPLICATION PROCESS

When application process begins:

show:

Aplica está trabajando por vos

Application queue.

Example:

Ramp

Growth Associate

✓ CV adaptado

✓ Información completada

Submitting...

Next:

Mercado Libre

Growth Analyst

Preparing CV...

Next:

Stripe

Marketing Associate

Waiting

Do not pretend an application succeeded if it did not.

Possible statuses:

Preparing

CV ready

Applying

Submitted

Needs your input

Failed

Job expired

Unsupported application

USER INPUT REQUIRED

If Aplica encounters something it cannot truthfully answer:

pause that application.

Example:

Necesitamos tu ayuda

Ramp pregunta:

“Describe your experience working with enterprise customers.”

Generated draft:

[editable answer]

Buttons:

Enviar respuesta

Editar

Saltar trabajo

The generated response may ONLY use facts available in the user's profile.

APPLICATION TRACKER

Route:

/applications

Heading:

Tus aplicaciones

Filters:

Todas

Enviadas

Necesitan atención

Entrevistas

Rechazadas

Archived

Each row:

company logo

Role

Company

Applied date

CV used

Status

Match score

Source

WHATSAPP

During onboarding collect WhatsApp number.

After subscription allow WhatsApp notifications.

Example message:

Aplica

Terminamos por hoy 👋

Aplicamos a 24 trabajos.

19 enviados correctamente

3 necesitan una respuesta tuya

2 ya no estaban disponibles

Ver aplicaciones

Notifications should be useful, not spammy.

PROFILE

Route:

/profile

Sections:

Datos personales

CV base

Experiencia

Estudios

Habilidades

Idiomas

Preferencias laborales

Salario

Ubicación

Autorización laboral

Application answers

WhatsApp

Subscription

Privacy

Delete account

CV GENERATION

For every selected job:

generate a job-specific CV.

The CV generator may:

reorder experience

emphasize relevant skills

rewrite bullet wording

adjust summary

prioritize relevant achievements

use terminology appearing in the job description where truthful

shorten irrelevant experience

The CV generator may NEVER:

create employers

create degrees

change employment dates

increase years of experience

add skills user does not possess

invent achievements

invent metrics

change job titles to materially different roles

claim certifications user does not hold

EMPTY STATES

If there are no strong matches:

Do NOT say:

“No jobs.”

Say:

Todavía no encontramos suficientes trabajos que encajen con tus criterios.

Then suggest relaxing:

location

salary

remote requirement

seniority

industry

Button:

Ajustar búsqueda

ERROR STATES

Create beautiful states for:

CV could not be parsed

payment failed

application expired

job removed

duplicate application detected

unsupported ATS

login required

user input required

network failure

Always clearly explain what happened.

Never pretend something succeeded.

MOBILE

This product must be excellent on mobile.

The onboarding especially should feel native-app-like.

On mobile:

single question screens

large touch targets

sticky bottom CTA

minimal navigation

Job results should collapse elegantly.

Mass apply CTA should remain sticky.

DESKTOP

Use centered max-width layouts.

Onboarding:

approximately 600–700px content width.

Results:

1100–1250px.

Do not stretch content across the entire monitor.

PRODUCT PRINCIPLE

The main feeling we want users to have is:

“I gave Aplica everything once. Now it does the repetitive work for me.”

Not:

“I'm using another AI tool.”

AI should mostly be invisible.

Do not put the word “AI” everywhere.

The product itself should demonstrate the intelligence.

IMPORTANT IMPLEMENTATION RULE

Build the experience with realistic data models and reusable components.

Do not create a static marketing mockup.

Create actual:

authentication states

onboarding state

profile data structures

job data structures

match scores

job filtering

job selection

subscription state

application queue state

application statuses

responsive navigation

Use mock data initially where external APIs are not yet connected, but architect components so real backend services can replace them.

Suggested routes:

/

/login

/signup

/onboarding

/jobs

/jobs/:id

/upgrade

/applications

/profile

/settings

FINAL INSTRUCTION

Before generating any component, remember:

This should NOT look like a template.

Avoid the visual conventions used by generic AI SaaS landing pages.

Prioritize:

whitespace

typography

interaction

search

real product UI

subtle transitions

clear hierarchy

minimal color

consumer polish

The end result should look like a product people would trust with their career, not like a hackathon project.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aplica-career-path.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bd0e59ea-eb97-4ba2-b7c3-f9878bca813a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
