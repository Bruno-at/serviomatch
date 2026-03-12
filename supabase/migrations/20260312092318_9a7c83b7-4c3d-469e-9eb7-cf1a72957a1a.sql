
-- Gift catalog
CREATE TABLE public.gift_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  emoji text NOT NULL,
  coin_cost integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view gifts" ON public.gift_catalog FOR SELECT TO authenticated USING (true);

-- User coins
CREATE TABLE public.user_coins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_coins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own coins" ON public.user_coins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own coins" ON public.user_coins FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coins" ON public.user_coins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Gift transactions
CREATE TABLE public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  gift_name text NOT NULL,
  gift_emoji text NOT NULL,
  coin_cost integer NOT NULL DEFAULT 0,
  match_id uuid REFERENCES public.matches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can send gifts" ON public.gift_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can view own gifts" ON public.gift_transactions FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Add verification and boost columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_selfie_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_boosted boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_spotlight boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spotlight_expires_at timestamptz;

-- Seed gift catalog
INSERT INTO public.gift_catalog (name, emoji, coin_cost) VALUES
  ('Rose', '🌹', 10),
  ('Heart', '❤️', 15),
  ('Coffee', '☕', 5),
  ('Music Note', '🎵', 8),
  ('Diamond', '💎', 50),
  ('Star', '⭐', 20),
  ('Fire', '🔥', 25),
  ('Kiss', '💋', 30);

-- Enable realtime for gift_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_transactions;

-- Speed dating sessions
CREATE TABLE public.speed_dating_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  user1_liked boolean DEFAULT false,
  user2_liked boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.speed_dating_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions" ON public.speed_dating_sessions FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create sessions" ON public.speed_dating_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own sessions" ON public.speed_dating_sessions FOR UPDATE TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id);
