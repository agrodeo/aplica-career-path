import { supabase } from "@/integrations/supabase/client";

export type VerifiedApplicationAnswerInput = {
  answerKey: string;
  answerType: "boolean" | "text" | "numeric";
  booleanValue?: boolean | null;
  textValue?: string | null;
  numericValue?: number | null;
};

export async function saveVerifiedApplicationAnswers({ data }: { data: { answers: VerifiedApplicationAnswerInput[] } }) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sesión no válida.");

  const rows = data.answers.map((answer) => {
    const answerKey = answer.answerKey.trim();
    if (!answerKey) throw new Error("Respuesta inválida.");

    if (answer.answerType === "boolean") {
      if (typeof answer.booleanValue !== "boolean") throw new Error("Elegí Sí o No.");
      return { user_id: auth.user.id, canonical_key: answerKey, answer_type: "boolean", boolean_value: answer.booleanValue, text_value: null, numeric_value: null, user_confirmed: true };
    }
    if (answer.answerType === "numeric") {
      const value = Number(answer.numericValue);
      if (!Number.isFinite(value)) throw new Error("Ingresá un número válido.");
      return { user_id: auth.user.id, canonical_key: answerKey, answer_type: "numeric", boolean_value: null, text_value: null, numeric_value: value, user_confirmed: true };
    }
    const value = (answer.textValue ?? "").trim().slice(0, 5000);
    if (!value) throw new Error("Completá la respuesta antes de guardarla.");
    return { user_id: auth.user.id, canonical_key: answerKey, answer_type: "text", boolean_value: null, text_value: value, numeric_value: null, user_confirmed: true };
  });

  const { error } = await supabase.from("application_answers").upsert(rows, { onConflict: "user_id,canonical_key" });
  if (error) throw new Error(error.message);
  return { ok: true, saved: rows.length };
}
