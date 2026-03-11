
-- Profile visitors table
CREATE TABLE public.profile_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  visited_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(visitor_id, visited_id)
);

ALTER TABLE public.profile_visitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert visits" ON public.profile_visitors
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = visitor_id);

CREATE POLICY "Users can see their own visitors" ON public.profile_visitors
  FOR SELECT TO authenticated
  USING (auth.uid() = visited_id OR auth.uid() = visitor_id);

-- Add location columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS last_online timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_online boolean DEFAULT false;

-- Enable realtime for likes table
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_visitors;
