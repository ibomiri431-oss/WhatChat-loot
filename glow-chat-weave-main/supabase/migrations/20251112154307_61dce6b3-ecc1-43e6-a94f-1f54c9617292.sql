-- Drop existing foreign key and recreate with profiles table
ALTER TABLE public.statuses DROP CONSTRAINT IF EXISTS statuses_user_id_fkey;

-- Add foreign key to profiles table
ALTER TABLE public.statuses 
ADD CONSTRAINT statuses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Do the same for status_views
ALTER TABLE public.status_views DROP CONSTRAINT IF EXISTS status_views_viewer_id_fkey;

ALTER TABLE public.status_views 
ADD CONSTRAINT status_views_viewer_id_fkey 
FOREIGN KEY (viewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Do the same for status_likes
ALTER TABLE public.status_likes DROP CONSTRAINT IF EXISTS status_likes_user_id_fkey;

ALTER TABLE public.status_likes 
ADD CONSTRAINT status_likes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;