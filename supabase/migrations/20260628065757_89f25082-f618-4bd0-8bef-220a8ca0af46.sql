
-- 1) profile_private: house sensitive fields
CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  date_of_birth date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private TO authenticated;
GRANT ALL ON public.profile_private TO service_role;
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can read own private profile" ON public.profile_private
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner can insert own private profile" ON public.profile_private
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can update own private profile" ON public.profile_private
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner can delete own private profile" ON public.profile_private
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Backfill from profiles
INSERT INTO public.profile_private (user_id, first_name, last_name, date_of_birth)
SELECT user_id, first_name, last_name, date_of_birth
FROM public.profiles
WHERE first_name IS NOT NULL OR last_name IS NOT NULL OR date_of_birth IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Drop the sensitive columns from public profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS date_of_birth;

-- 2) gift_transactions: revoke direct insert; provide send_gift RPC
DROP POLICY IF EXISTS "Users can send gifts" ON public.gift_transactions;

CREATE OR REPLACE FUNCTION public.send_gift(_receiver_id uuid, _gift_name text, _gift_emoji text, _match_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost integer;
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _receiver_id IS NULL OR _receiver_id = _uid THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  IF _gift_name IS NULL OR length(_gift_name) = 0 OR length(_gift_name) > 100 THEN RAISE EXCEPTION 'Invalid gift'; END IF;

  SELECT coin_cost INTO _cost FROM public.gift_catalog WHERE name = _gift_name LIMIT 1;
  IF _cost IS NULL THEN RAISE EXCEPTION 'Unknown gift'; END IF;

  PERFORM public.adjust_coin_balance(-_cost, 'gift_send', jsonb_build_object('gift_name', _gift_name, 'receiver_id', _receiver_id));

  INSERT INTO public.gift_transactions (sender_id, receiver_id, gift_name, gift_emoji, coin_cost, match_id)
  VALUES (_uid, _receiver_id, _gift_name, _gift_emoji, _cost, _match_id)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_gift(uuid, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_gift(uuid, text, text, uuid) TO authenticated;

-- 3) match_streaks: revoke client writes (no client write code exists)
DROP POLICY IF EXISTS "Users can upsert streaks for their matches" ON public.match_streaks;
DROP POLICY IF EXISTS "Users can update streaks for their matches" ON public.match_streaks;
REVOKE INSERT, UPDATE, DELETE ON public.match_streaks FROM authenticated;

-- 4) secret_crushes: tighten UPDATE to disallow client setting is_mutual; route via RPC
DROP POLICY IF EXISTS "Users can update own crushes" ON public.secret_crushes;
-- (no replacement UPDATE policy: crushers may delete; mutual flag set by RPC only)

CREATE OR REPLACE FUNCTION public.confirm_mutual_crush(_other_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _has_a boolean;
  _has_b boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user_id IS NULL OR _other_user_id = _uid THEN RAISE EXCEPTION 'Invalid target'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.secret_crushes WHERE crusher_id = _uid AND crushed_id = _other_user_id) INTO _has_a;
  SELECT EXISTS(SELECT 1 FROM public.secret_crushes WHERE crusher_id = _other_user_id AND crushed_id = _uid) INTO _has_b;

  IF NOT (_has_a AND _has_b) THEN
    RETURN false;
  END IF;

  UPDATE public.secret_crushes
     SET is_mutual = true
   WHERE (crusher_id = _uid AND crushed_id = _other_user_id)
      OR (crusher_id = _other_user_id AND crushed_id = _uid);

  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.confirm_mutual_crush(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_mutual_crush(uuid) TO authenticated;

-- 5) user_verifications: revoke direct INSERT/UPDATE; force via submit_verification RPC
DROP POLICY IF EXISTS "Users can insert own verification" ON public.user_verifications;
DROP POLICY IF EXISTS "Users can update own verification" ON public.user_verifications;
REVOKE INSERT, UPDATE, DELETE ON public.user_verifications FROM authenticated;
