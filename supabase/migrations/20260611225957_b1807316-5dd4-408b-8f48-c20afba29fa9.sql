
-- =========================================================
-- 1. MATCHES: prevent forced matches
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Users can create matches" ON public.matches;
DROP POLICY IF EXISTS "Users can insert their own matches" ON public.matches;
REVOKE INSERT ON public.matches FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_match_if_mutual(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _u1 uuid;
  _u2 uuid;
  _match_id uuid;
  _has_a boolean;
  _has_b boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user_id IS NULL OR _other_user_id = _uid THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.likes WHERE liker_id = _uid AND liked_id = _other_user_id) INTO _has_a;
  SELECT EXISTS (SELECT 1 FROM public.likes WHERE liker_id = _other_user_id AND liked_id = _uid) INTO _has_b;

  IF NOT (_has_a AND _has_b) THEN
    -- also accept mutual secret crushes
    IF NOT EXISTS (
      SELECT 1 FROM public.secret_crushes
       WHERE ((crusher_id = _uid AND crushed_id = _other_user_id)
           OR (crusher_id = _other_user_id AND crushed_id = _uid))
       GROUP BY 1 HAVING count(*) >= 2
    ) THEN
      RAISE EXCEPTION 'Mutual interest required';
    END IF;
  END IF;

  IF _uid < _other_user_id THEN _u1 := _uid; _u2 := _other_user_id;
  ELSE _u1 := _other_user_id; _u2 := _uid;
  END IF;

  SELECT id INTO _match_id FROM public.matches WHERE user1_id = _u1 AND user2_id = _u2;
  IF _match_id IS NOT NULL THEN RETURN _match_id; END IF;

  INSERT INTO public.matches (user1_id, user2_id) VALUES (_u1, _u2) RETURNING id INTO _match_id;
  RETURN _match_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_match_if_mutual(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_match_if_mutual(uuid) TO authenticated;

-- =========================================================
-- 2. PROFILES: column-level UPDATE; privileged columns via RPC
-- =========================================================
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (
  display_name, avatar_url, bio, age, location, interests, photos,
  voice_intro_url, video_url, personality_answers,
  is_online, last_online, available_tonight, latitude, longitude
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_boost()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.adjust_coin_balance(-30, 'boost_30m', '{}'::jsonb);
  _exp := now() + interval '30 minutes';
  UPDATE public.profiles SET is_boosted = true, boost_expires_at = _exp WHERE user_id = _uid;
  RETURN _exp;
END; $$;
REVOKE EXECUTE ON FUNCTION public.activate_boost() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_boost() TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_spotlight()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _exp timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.adjust_coin_balance(-50, 'spotlight_1h', '{}'::jsonb);
  _exp := now() + interval '1 hour';
  UPDATE public.profiles SET is_spotlight = true, spotlight_expires_at = _exp WHERE user_id = _uid;
  RETURN _exp;
END; $$;
REVOKE EXECUTE ON FUNCTION public.activate_spotlight() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.activate_spotlight() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_verification(_selfie_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _selfie_url IS NULL OR length(_selfie_url) < 8 OR length(_selfie_url) > 2048 THEN
    RAISE EXCEPTION 'Invalid selfie url';
  END IF;
  INSERT INTO public.user_verifications (user_id, selfie_url, updated_at)
    VALUES (_uid, _selfie_url, now())
    ON CONFLICT (user_id) DO UPDATE SET selfie_url = EXCLUDED.selfie_url, updated_at = now();
  UPDATE public.profiles SET is_verified = true WHERE user_id = _uid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_verification(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.submit_verification(text) TO authenticated;

-- =========================================================
-- 3. SUBSCRIPTIONS: read-only from client
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated, anon;

-- =========================================================
-- 4. USER_COINS: remove client INSERT
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own coins" ON public.user_coins;
DROP POLICY IF EXISTS "Users can insert their own coins" ON public.user_coins;
REVOKE INSERT ON public.user_coins FROM authenticated, anon;

-- =========================================================
-- 5. DAILY REWARDS: server-side claim only
-- =========================================================
DROP POLICY IF EXISTS "Users can insert own daily rewards" ON public.daily_rewards;
DROP POLICY IF EXISTS "Users can update own daily rewards" ON public.daily_rewards;
DROP POLICY IF EXISTS "Users can insert their own daily rewards" ON public.daily_rewards;
DROP POLICY IF EXISTS "Users can update their own daily rewards" ON public.daily_rewards;
REVOKE INSERT, UPDATE, DELETE ON public.daily_rewards FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS TABLE(streak_count int, coin_reward int, day_index int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.daily_rewards%ROWTYPE;
  _today date := (now() at time zone 'utc')::date;
  _diff int;
  _new_streak int;
  _day_idx int;
  _coin int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _row FROM public.daily_rewards WHERE user_id = _uid;

  IF NOT FOUND THEN
    _new_streak := 1;
  ELSE
    _diff := _today - _row.last_claim_date;
    IF _diff < 1 THEN RAISE EXCEPTION 'Already claimed today'; END IF;
    _new_streak := CASE WHEN _diff = 1 THEN _row.streak_count + 1 ELSE 1 END;
  END IF;

  _day_idx := ((_new_streak - 1) % 7);
  _coin := CASE _day_idx WHEN 0 THEN 10 WHEN 2 THEN 20 WHEN 4 THEN 30 WHEN 6 THEN 100 ELSE 0 END;

  INSERT INTO public.daily_rewards (user_id, last_claim_date, streak_count, total_claims)
  VALUES (_uid, _today, _new_streak, COALESCE(_row.total_claims, 0) + 1)
  ON CONFLICT (user_id) DO UPDATE
    SET last_claim_date = _today,
        streak_count = _new_streak,
        total_claims = COALESCE(public.daily_rewards.total_claims, 0) + 1;

  IF _coin > 0 THEN
    PERFORM public.adjust_coin_balance(_coin, 'daily_reward', jsonb_build_object('day', _day_idx + 1));
  END IF;

  RETURN QUERY SELECT _new_streak, _coin, _day_idx;
END; $$;
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;

-- =========================================================
-- 6. REALTIME: remove sensitive tables from broadcast publication
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'matches','likes','profile_visitors','gift_transactions','match_streaks',
    'live_join_requests','call_sessions','user_challenges','live_rooms','notifications'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- =========================================================
-- 7. Lock down SECURITY DEFINER helpers from anon/public
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.adjust_coin_balance(integer, text, jsonb) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.adjust_coin_balance(integer, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.send_notification(uuid, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_coordinates() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_my_coordinates() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
