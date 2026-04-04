
CREATE TABLE public.crush_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '💕',
  event_type TEXT NOT NULL DEFAULT 'general',
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  crush_limit_override INTEGER DEFAULT NULL,
  reveal_mutual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crush_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view crush events"
ON public.crush_events
FOR SELECT
TO authenticated
USING (true);
