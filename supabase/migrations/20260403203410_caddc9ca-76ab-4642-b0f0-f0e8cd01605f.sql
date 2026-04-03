
CREATE TABLE public.secret_crushes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crusher_id UUID NOT NULL,
  crushed_id UUID NOT NULL,
  is_mutual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (crusher_id, crushed_id)
);

ALTER TABLE public.secret_crushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can add own crushes"
ON public.secret_crushes
FOR INSERT
WITH CHECK (auth.uid() = crusher_id);

CREATE POLICY "Users can view own crushes or mutual"
ON public.secret_crushes
FOR SELECT
USING (auth.uid() = crusher_id OR (auth.uid() = crushed_id AND is_mutual = true));

CREATE POLICY "Users can delete own crushes"
ON public.secret_crushes
FOR DELETE
USING (auth.uid() = crusher_id);

CREATE POLICY "Users can update own crushes"
ON public.secret_crushes
FOR UPDATE
USING (auth.uid() = crusher_id OR auth.uid() = crushed_id);
