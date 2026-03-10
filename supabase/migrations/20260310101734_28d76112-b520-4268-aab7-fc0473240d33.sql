
-- Add video and personality columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personality_answers jsonb DEFAULT '{}'::jsonb;

-- Create profile-videos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-videos', 'profile-videos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for profile-videos bucket
CREATE POLICY "Users can upload own videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view profile videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-videos');
