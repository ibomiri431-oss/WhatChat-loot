-- Create function to create chat with participants
CREATE OR REPLACE FUNCTION public.create_direct_chat(
  other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_chat_id UUID;
  existing_chat_id UUID;
BEGIN
  -- Check if chat already exists between these two users
  SELECT cp1.chat_id INTO existing_chat_id
  FROM chat_participants cp1
  INNER JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
  INNER JOIN chats c ON c.id = cp1.chat_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
    AND c.type = 'direct'
  LIMIT 1;
  
  -- If chat exists, return it
  IF existing_chat_id IS NOT NULL THEN
    RETURN existing_chat_id;
  END IF;
  
  -- Create new chat
  INSERT INTO chats (type)
  VALUES ('direct')
  RETURNING id INTO new_chat_id;
  
  -- Add both participants
  INSERT INTO chat_participants (chat_id, user_id)
  VALUES 
    (new_chat_id, auth.uid()),
    (new_chat_id, other_user_id);
  
  RETURN new_chat_id;
END;
$$;