
-- Live rooms table
CREATE TABLE public.live_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  viewer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.live_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active live rooms"
  ON public.live_rooms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create their own live rooms"
  ON public.live_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their own rooms"
  ON public.live_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = host_id);

-- Live room messages (chat)
CREATE TABLE public.live_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'gift', 'join', 'system'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view live messages"
  ON public.live_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can send live messages"
  ON public.live_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Enable realtime for live messages and rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_rooms;

-- Indexes
CREATE INDEX idx_live_rooms_active ON public.live_rooms(is_active) WHERE is_active = true;
CREATE INDEX idx_live_rooms_host ON public.live_rooms(host_id);
CREATE INDEX idx_live_messages_room ON public.live_messages(room_id);
CREATE INDEX idx_live_messages_created ON public.live_messages(created_at);
