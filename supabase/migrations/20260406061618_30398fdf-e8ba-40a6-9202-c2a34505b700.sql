
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  INSERT INTO public.user_coins (user_id, balance)
  VALUES (NEW.id, 100)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Backfill user_coins for existing users who don't have one
INSERT INTO public.user_coins (user_id, balance)
SELECT u.id, 100
FROM auth.users u
LEFT JOIN public.user_coins c ON c.user_id = u.id
WHERE c.id IS NULL
ON CONFLICT DO NOTHING;
