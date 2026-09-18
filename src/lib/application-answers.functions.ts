import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const knownKeys = new Set([
  "work_authorization",
  "sponsorship",
  "salary_expectation",
  "relocation",
  "notice_period",
  "website",
  "portfolio",
  "linkedin",
  "current_company",
  "current_title",
  "years_experience",
  "country",
  "location",
]);

type AnswerInput = {
  answerKey: string;
  answerType: "boolean" | "text" | "numeric";
  booleanValue?: boolean | null;
  textValue?: string | null;
  numericValue?: number | null;
};

export const saveVerifiedApplicationAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { answers: AnswerInput[] }) => {
    if (!Array.isArray(data.answers) || !data.answers.length) {
      throw new Error("No hay respuestas para guardar.");
    }

    const answers = data.answers.slice(0, 25).map((answer) => {
      const answerKey = answer.answerKey.trim().slice(0, 240);
      if (!answerKey || (!answerKey.startsWith("custom:") && !knownKeys.has(answerKey))) {
        throw new Error("La pregunta no pertenece a un campo de aplicación soportado.");
      }

      if (answer.answerType === "boolean") {
        if (typeof answer.booleanValue !== "boolean") {
          throw new Error("Elegí Sí o No.");
        }
        return {
          answerKey,
          answerType: "boolean" as const,
          booleanValue: answer.booleanValue,
          textValue: null,
          numericValue: null,
        };
      }

      if (answer.answerType === "numeric") {
        const value = Number(answer.numericValue);
        if (!Number.isFinite(value)) throw new Error("Ingresá un número válido.");
        return {
          answerKey,
          answerType: "numeric" as const,
          booleanValue: null,
          textValue: null,
          numericValue: value,
        };
      }

      const value = (answer.textValue ?? "").trim().slice(0, 5000);
      if (!value) throw new Error("Completá la respuesta antes de guardarla.");
      return {
        answerKey,
        answerType: "text" as const,
        booleanValue: null,
        textValue: value,
        numericValue: null,
      };
    });

    return { answers };
  })
  .handler(async ({ data, context }) => {
    const rows = data.answers.map((answer) => ({
      user_id: context.userId,
      canonical_key: answer.answerKey,
      answer_type: answer.answerType,
      boolean_value: answer.booleanValue,
      text_value: answer.textValue,
      numeric_value: answer.numericValue,
      user_confirmed: true,
    }));

    const { error } = await context.supabase
      .from("application_answers")
      .upsert(rows, { onConflict: "user_id,canonical_key" });
    if (error) throw new Error(error.message);

    return { ok: true, saved: rows.length };
  });
