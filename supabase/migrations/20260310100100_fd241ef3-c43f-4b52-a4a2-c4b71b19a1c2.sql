
-- Add voice_intro_url column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_intro_url text DEFAULT NULL;

-- Create voice-intros storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-intros', 'voice-intros', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone authenticated can read voice intros
CREATE POLICY "Public read voice intros"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice-intros');

-- RLS: users can upload their own voice intros
CREATE POLICY "Users upload own voice intros"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-intros' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can update their own voice intros
CREATE POLICY "Users update own voice intros"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'voice-intros' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: users can delete their own voice intros
CREATE POLICY "Users delete own voice intros"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice-intros' AND (storage.foldername(name))[1] = auth.uid()::text);
