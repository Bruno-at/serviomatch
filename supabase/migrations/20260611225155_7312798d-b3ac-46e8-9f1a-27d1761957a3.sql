
DROP POLICY IF EXISTS "Authenticated users can read realtime" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can write realtime" ON public.messages;

DROP POLICY IF EXISTS "Authenticated users can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can write realtime" ON realtime.messages;

CREATE POLICY "Scoped realtime read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'messages:%'
      OR realtime.topic() LIKE 'typing:%'
      OR realtime.topic() LIKE 'gifts:%' THEN
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id::text = split_part(realtime.topic(), ':', 2)
          AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
      )
    WHEN realtime.topic() LIKE 'user:%'
      OR realtime.topic() LIKE 'notifications:%'
      OR realtime.topic() LIKE 'calls:%' THEN
      split_part(realtime.topic(), ':', 2) = auth.uid()::text
    ELSE false
  END
);

CREATE POLICY "Scoped realtime write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'messages:%'
      OR realtime.topic() LIKE 'typing:%'
      OR realtime.topic() LIKE 'gifts:%' THEN
      EXISTS (
        SELECT 1 FROM public.matches m
        WHERE m.id::text = split_part(realtime.topic(), ':', 2)
          AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
      )
    WHEN realtime.topic() LIKE 'user:%'
      OR realtime.topic() LIKE 'notifications:%'
      OR realtime.topic() LIKE 'calls:%' THEN
      split_part(realtime.topic(), ':', 2) = auth.uid()::text
    ELSE false
  END
);

REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (
  id, user_id, display_name, avatar_url, bio, age, location, interests,
  created_at, updated_at, photos, voice_intro_url, video_url,
  personality_answers, last_online, is_online, is_verified, is_boosted,
  boost_expires_at, is_spotlight, spotlight_expires_at, available_tonight
) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_coordinates()
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT latitude, longitude FROM public.profiles WHERE user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_coordinates() TO authenticated;

REVOKE UPDATE, DELETE ON public.user_coins FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
REVOKE INSERT ON public.notifications FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;
REVOKE INSERT, UPDATE, DELETE ON public.user_badges FROM authenticated, anon;
