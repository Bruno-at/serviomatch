
-- 1) live_messages: restrict SELECT to host or accepted participants
DROP POLICY IF EXISTS "Anyone authenticated can view live messages" ON public.live_messages;
CREATE POLICY "Live messages visible to host and accepted viewers"
ON public.live_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.live_rooms r WHERE r.id = live_messages.room_id AND r.host_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.live_join_requests j
    WHERE j.room_id = live_messages.room_id
      AND j.user_id = auth.uid()
      AND j.status = 'accepted'
  )
);

-- 2) profiles: revoke UPDATE on privileged columns
REVOKE UPDATE (is_verified, is_boosted, boost_expires_at, is_spotlight, spotlight_expires_at)
  ON public.profiles FROM authenticated, anon, PUBLIC;

-- 3) referrals: restrict to authenticated role only
DROP POLICY IF EXISTS "System can update referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;

CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can create referrals"
ON public.referrals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update referrals they're part of"
ON public.referrals FOR UPDATE TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id)
WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);

REVOKE ALL ON public.referrals FROM anon;

-- 4) speed_dating_sessions: only user1 may insert; pairing via RPC
DROP POLICY IF EXISTS "Users can create sessions" ON public.speed_dating_sessions;
CREATE POLICY "Users can create sessions as user1"
ON public.speed_dating_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user1_id AND user1_id <> user2_id);

CREATE OR REPLACE FUNCTION public.create_speed_dating_session(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other_user_id IS NULL OR _other_user_id = _uid THEN
    RAISE EXCEPTION 'Invalid partner';
  END IF;
  INSERT INTO public.speed_dating_sessions (user1_id, user2_id, started_at)
  VALUES (_uid, _other_user_id, now())
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_speed_dating_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_speed_dating_session(uuid) TO authenticated, service_role;
