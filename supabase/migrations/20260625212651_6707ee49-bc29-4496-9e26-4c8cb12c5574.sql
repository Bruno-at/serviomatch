ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET
  email_verified = COALESCE(u.email_confirmed_at IS NOT NULL, false),
  profile_completed = true,
  onboarding_completed = true,
  updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND p.onboarding_completed = false
  AND (
    NULLIF(TRIM(COALESCE(p.first_name, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(p.last_name, '')), '') IS NOT NULL
    OR p.date_of_birth IS NOT NULL
    OR NULLIF(TRIM(COALESCE(p.gender, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(p.looking_for, '')), '') IS NOT NULL
    OR COALESCE(array_length(p.dating_intents, 1), 0) > 0
    OR COALESCE(array_length(p.photos, 1), 0) > 0
    OR NULLIF(TRIM(COALESCE(p.avatar_url, '')), '') IS NOT NULL
    OR NULLIF(TRIM(COALESCE(p.bio, '')), '') IS NOT NULL
    OR p.age IS NOT NULL
  );

UPDATE public.profiles p
SET
  email_verified = COALESCE(u.email_confirmed_at IS NOT NULL, p.email_verified),
  profile_completed = CASE WHEN p.onboarding_completed THEN true ELSE p.profile_completed END,
  updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id
  AND (p.email_verified IS DISTINCT FROM COALESCE(u.email_confirmed_at IS NOT NULL, false)
       OR (p.onboarding_completed = true AND p.profile_completed = false));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id,
    display_name,
    email_verified,
    profile_completed,
    onboarding_completed
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name', ''), split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false),
    false,
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email_verified = COALESCE(EXCLUDED.email_verified, public.profiles.email_verified),
    updated_at = now();

  INSERT INTO public.user_coins (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;