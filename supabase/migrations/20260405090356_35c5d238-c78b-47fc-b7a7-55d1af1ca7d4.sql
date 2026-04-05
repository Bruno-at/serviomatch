
CREATE TABLE public.live_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.live_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own requests
CREATE POLICY "Users can create join requests"
ON public.live_join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view requests they made OR requests for rooms they host
CREATE POLICY "Users can view relevant join requests"
ON public.live_join_requests
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.live_rooms
    WHERE live_rooms.id = live_join_requests.room_id
    AND live_rooms.host_id = auth.uid()
  )
);

-- Hosts can update requests for their rooms
CREATE POLICY "Hosts can update join requests"
ON public.live_join_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.live_rooms
    WHERE live_rooms.id = live_join_requests.room_id
    AND live_rooms.host_id = auth.uid()
  )
);

-- Users can delete their own requests
CREATE POLICY "Users can delete own join requests"
ON public.live_join_requests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for join requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_join_requests;
