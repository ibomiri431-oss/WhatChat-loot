-- Drop and recreate the INSERT policy for chats with proper role specification
DROP POLICY IF EXISTS "Users can create chats" ON public.chats;

CREATE POLICY "Users can create chats"
  ON public.chats 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Also update the SELECT policy to ensure it's properly scoped
DROP POLICY IF EXISTS "Users can view chats they are part of" ON public.chats;

CREATE POLICY "Users can view chats they are part of"
  ON public.chats 
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants
      WHERE chat_id = chats.id AND user_id = auth.uid()
    )
  );