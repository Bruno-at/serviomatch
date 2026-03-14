-- Match streaks table
CREATE TABLE public.match_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  streak_count integer NOT NULL DEFAULT 0,
  last_message_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id)
);

ALTER TABLE public.match_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view streaks for their matches"
ON public.match_streaks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM matches
  WHERE matches.id = match_streaks.match_id
  AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
));

CREATE POLICY "Users can upsert streaks for their matches"
ON public.match_streaks FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM matches
  WHERE matches.id = match_streaks.match_id
  AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
));

CREATE POLICY "Users can update streaks for their matches"
ON public.match_streaks FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM matches
  WHERE matches.id = match_streaks.match_id
  AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
));

-- Swipe history for undo feature
CREATE TABLE public.swipe_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  swiped_id uuid NOT NULL,
  direction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.swipe_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own swipe history"
ON public.swipe_history FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.match_streaks;