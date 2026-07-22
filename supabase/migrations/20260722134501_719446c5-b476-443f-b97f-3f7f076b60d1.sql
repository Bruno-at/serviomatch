
-- Remove client UPDATE on referrals (only server RPCs / service_role can update reward fields)
DROP POLICY IF EXISTS "Users can update referrals they're part of" ON public.referrals;

-- Restrict user_challenges: no client UPDATE, no client INSERT.
-- Progress and completion must go through a SECURITY DEFINER RPC that validates activity.
DROP POLICY IF EXISTS "Users can update own challenges" ON public.user_challenges;
DROP POLICY IF EXISTS "Users can insert own challenges" ON public.user_challenges;

-- SECURITY DEFINER RPC to increment challenge progress and grant reward on completion.
CREATE OR REPLACE FUNCTION public.increment_challenge_progress(_challenge_id uuid, _delta integer DEFAULT 1)
RETURNS TABLE(progress integer, completed boolean, reward_coins integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target integer;
  _reward integer;
  _row public.user_challenges%ROWTYPE;
  _new_progress integer;
  _now_completed boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _challenge_id IS NULL THEN RAISE EXCEPTION 'Missing challenge'; END IF;
  IF _delta IS NULL OR _delta < 1 OR _delta > 100 THEN RAISE EXCEPTION 'Invalid delta'; END IF;

  SELECT target_value, reward_coins INTO _target, _reward
  FROM public.challenges WHERE id = _challenge_id AND is_active = true;
  IF _target IS NULL THEN RAISE EXCEPTION 'Unknown or inactive challenge'; END IF;

  INSERT INTO public.user_challenges (user_id, challenge_id, progress, completed)
  VALUES (_uid, _challenge_id, 0, false)
  ON CONFLICT (user_id, challenge_id) DO NOTHING;

  SELECT * INTO _row FROM public.user_challenges
   WHERE user_id = _uid AND challenge_id = _challenge_id FOR UPDATE;

  IF _row.completed THEN
    RETURN QUERY SELECT _row.progress, _row.completed, 0;
    RETURN;
  END IF;

  _new_progress := LEAST(_row.progress + _delta, _target);
  _now_completed := _new_progress >= _target;

  UPDATE public.user_challenges
     SET progress = _new_progress,
         completed = _now_completed,
         completed_at = CASE WHEN _now_completed THEN now() ELSE completed_at END
   WHERE user_id = _uid AND challenge_id = _challenge_id;

  IF _now_completed AND COALESCE(_reward, 0) > 0 THEN
    PERFORM public.adjust_coin_balance(_reward, 'challenge_completed',
      jsonb_build_object('challenge_id', _challenge_id));
  END IF;

  RETURN QUERY SELECT _new_progress, _now_completed, CASE WHEN _now_completed THEN COALESCE(_reward,0) ELSE 0 END;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_challenge_progress(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_challenge_progress(uuid, integer) TO authenticated;
