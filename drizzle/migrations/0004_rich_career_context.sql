-- Rich career context for the long onboarding / AI tailoring layer.
-- Every claim the resume generator may use must have explicit provenance.
CREATE TABLE public.career_contexts (
  user_id uuid PRIMARY KEY,
  preferred_tasks text[] NOT NULL DEFAULT '{}',
  avoid_tasks text[] NOT NULL DEFAULT '{}',
  strengths text[] NOT NULL DEFAULT '{}',
  differentiators text[] NOT NULL DEFAULT '{}',
  tools text[] NOT NULL DEFAULT '{}',
  responsibilities text[] NOT NULL DEFAULT '{}',
  results text[] NOT NULL DEFAULT '{}',
  proud_project text,
  challenge_story text,
  career_goal text,
  target_environment text,
  availability text,
  travel_preference text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_contexts TO authenticated;
GRANT ALL ON public.career_contexts TO service_role;
ALTER TABLE public.career_contexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own career context" ON public.career_contexts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER career_contexts_touch
  BEFORE UPDATE ON public.career_contexts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.writing_preferences (
  user_id uuid PRIMARY KEY,
  voice text NOT NULL DEFAULT 'balanced'
    CHECK (voice IN ('direct','ambitious','technical','balanced')),
  emphasis text[] NOT NULL DEFAULT '{}',
  de_emphasis text[] NOT NULL DEFAULT '{}',
  summary_style text NOT NULL DEFAULT 'concise',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writing_preferences TO authenticated;
GRANT ALL ON public.writing_preferences TO service_role;
ALTER TABLE public.writing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own writing preferences" ON public.writing_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER writing_preferences_touch
  BEFORE UPDATE ON public.writing_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.fact_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fact_type text NOT NULL,
  claim text NOT NULL,
  source_type text NOT NULL,
  source_ref text,
  user_confirmed boolean NOT NULL DEFAULT false,
  allowed_for_resume boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 1
    CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fact_ledger_user_resume_idx
  ON public.fact_ledger(user_id, allowed_for_resume, user_confirmed);
CREATE INDEX fact_ledger_source_idx
  ON public.fact_ledger(user_id, source_type, source_ref);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fact_ledger TO authenticated;
GRANT ALL ON public.fact_ledger TO service_role;
ALTER TABLE public.fact_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fact ledger" ON public.fact_ledger
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER fact_ledger_touch
  BEFORE UPDATE ON public.fact_ledger
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Long onboarding can be safely resumed. Drafts never become resume facts until
-- the final review confirms them.
CREATE TABLE public.onboarding_drafts (
  user_id uuid PRIMARY KEY,
  last_step integer NOT NULL DEFAULT 1,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_drafts TO authenticated;
GRANT ALL ON public.onboarding_drafts TO service_role;
ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own onboarding draft" ON public.onboarding_drafts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER onboarding_drafts_touch
  BEFORE UPDATE ON public.onboarding_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
