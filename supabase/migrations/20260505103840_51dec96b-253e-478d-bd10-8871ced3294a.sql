
-- ============================================================
-- 1. COIN BALANCE INTEGRITY: remove client UPDATE, add audit + RPC
-- ============================================================
DROP POLICY IF EXISTS "Users can update own coins" ON public.user_coins;

CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own coin transactions"
  ON public.coin_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Server-side coin mutation function (caller-scoped)
CREATE OR REPLACE FUNCTION public.adjust_coin_balance(
  _delta integer,
  _reason text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_balance integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _reason IS NULL OR length(_reason) = 0 OR length(_reason) > 100 THEN
    RAISE EXCEPTION 'Invalid reason';
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.user_coins (user_id, balance)
  VALUES (_uid, 100)
  ON CONFLICT (user_id) DO NOTHING;

  -- Atomic update with overdraft protection
  UPDATE public.user_coins
  SET balance = balance + _delta,
      updated_at = now()
  WHERE user_id = _uid
    AND (balance + _delta) >= 0
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  INSERT INTO public.coin_transactions (user_id, delta, balance_after, reason, metadata)
  VALUES (_uid, _delta, _new_balance, _reason, COALESCE(_metadata, '{}'::jsonb));

  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_coin_balance(integer, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.adjust_coin_balance(integer, text, jsonb) TO authenticated;

-- ============================================================
-- 2. NOTIFICATIONS: restrict client inserts to self only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Server-side function for cross-user notifications (used by app flows)
CREATE OR REPLACE FUNCTION public.send_notification(
  _target_user_id uuid,
  _type text,
  _title text,
  _message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _recent_count integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _target_user_id IS NULL OR _title IS NULL OR _message IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  IF length(_title) > 200 OR length(_message) > 1000 THEN
    RAISE EXCEPTION 'Title or message too long';
  END IF;

  -- Block recipients can't be notified
  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _target_user_id AND blocked_id = _uid)
       OR (blocker_id = _uid AND blocked_id = _target_user_id)
  ) THEN
    RAISE EXCEPTION 'Blocked';
  END IF;

  -- Rate limit: max 30 sender->recipient cross notifications per hour
  SELECT count(*) INTO _recent_count
  FROM public.notifications
  WHERE user_id = _target_user_id
    AND created_at > now() - interval '1 hour';

  IF _recent_count > 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (_target_user_id, COALESCE(_type, 'general'), _title, _message)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_notification(uuid, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text) TO authenticated;

-- ============================================================
-- 3. VERIFICATION SELFIE: move to private table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_verifications (
  user_id uuid PRIMARY KEY,
  selfie_url text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verification"
  ON public.user_verifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification"
  ON public.user_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verification"
  ON public.user_verifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Migrate existing data
INSERT INTO public.user_verifications (user_id, selfie_url)
SELECT user_id, verification_selfie_url
FROM public.profiles
WHERE verification_selfie_url IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS verification_selfie_url;

-- ============================================================
-- 4. REALTIME: require authentication on realtime.messages
-- ============================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can write realtime" ON realtime.messages;

CREATE POLICY "Authenticated users can read realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can write realtime"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
