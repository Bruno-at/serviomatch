
-- Extend profiles with rich filterable attributes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS continent text,
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS sexuality text,
  ADD COLUMN IF NOT EXISTS star_sign text,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS children text,
  ADD COLUMN IF NOT EXISTS pets text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS smoking text,
  ADD COLUMN IF NOT EXISTS drinking text,
  ADD COLUMN IF NOT EXISTS education text,
  ADD COLUMN IF NOT EXISTS relationship_status text,
  ADD COLUMN IF NOT EXISTS religion text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS fitness text,
  ADD COLUMN IF NOT EXISTS diet text,
  ADD COLUMN IF NOT EXISTS sleep_schedule text,
  ADD COLUMN IF NOT EXISTS ethnicity text,
  ADD COLUMN IF NOT EXISTS personality_traits text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles(country);
CREATE INDEX IF NOT EXISTS idx_profiles_continent ON public.profiles(continent);
CREATE INDEX IF NOT EXISTS idx_profiles_height ON public.profiles(height_cm);

-- Filter preferences (persisted per user)
CREATE TABLE IF NOT EXISTS public.user_filter_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_filter_preferences TO authenticated;
GRANT ALL ON public.user_filter_preferences TO service_role;

ALTER TABLE public.user_filter_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own filter preferences"
  ON public.user_filter_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_filter_preferences_updated
  BEFORE UPDATE ON public.user_filter_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
