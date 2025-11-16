-- Create status_likes table for like functionality
CREATE TABLE IF NOT EXISTS public.status_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id UUID NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

-- Enable RLS
ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for status_likes
CREATE POLICY "Users can add likes to statuses"
  ON public.status_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their likes"
  ON public.status_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view status likes"
  ON public.status_likes
  FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime for status_likes
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_likes;