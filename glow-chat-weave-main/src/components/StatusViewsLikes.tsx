import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Heart } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ViewerData {
  id: string;
  viewer_id: string;
  viewed_at: string;
  profiles: {
    nickname: string;
    avatar_url: string | null;
  };
}

interface LikerData {
  id: string;
  user_id: string;
  liked_at: string;
  profiles: {
    nickname: string;
    avatar_url: string | null;
  };
}

interface StatusViewsLikesProps {
  statusId: string;
  isOwner: boolean;
}

export function StatusViewsLikes({ statusId, isOwner }: StatusViewsLikesProps) {
  const [views, setViews] = useState<ViewerData[]>([]);
  const [likes, setLikes] = useState<LikerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadViewsAndLikes();
    
    // Real-time updates
    const viewsChannel = supabase
      .channel(`status-views-${statusId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_views' as any,
          filter: `status_id=eq.${statusId}`
        },
        () => {
          loadViewsAndLikes();
        }
      )
      .subscribe();

    const likesChannel = supabase
      .channel(`status-likes-${statusId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'status_likes' as any,
          filter: `status_id=eq.${statusId}`
        },
        () => {
          loadViewsAndLikes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(viewsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [statusId]);

  const loadViewsAndLikes = async () => {
    try {
      // Load views
      const { data: viewsData } = await supabase
        .from('status_views' as any)
        .select(`
          *,
          profiles:viewer_id (nickname, avatar_url)
        `)
        .eq('status_id', statusId)
        .order('viewed_at', { ascending: false });

      // Load likes
      const { data: likesData } = await supabase
        .from('status_likes' as any)
        .select(`
          *,
          profiles:user_id (nickname, avatar_url)
        `)
        .eq('status_id', statusId)
        .order('liked_at', { ascending: false });

      setViews((viewsData as any) || []);
      setLikes((likesData as any) || []);
    } catch (error) {
      console.error('Error loading views/likes:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-3 text-white">
      {/* Likes */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-full hover:bg-black/60 transition-colors">
            <Heart className="h-4 w-4" fill={likes.length > 0 ? "currentColor" : "none"} />
            <span className="text-sm font-medium">{likes.length}</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Beğeniler ❤️</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {likes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Henüz beğeni yok</p>
            ) : (
              likes.map((like) => (
                <div key={like.id} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={like.profiles.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {like.profiles.nickname[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{like.profiles.nickname}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(like.liked_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Views (only for owner) */}
      {isOwner && (
        <Sheet>
          <SheetTrigger asChild>
            <button className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-full hover:bg-black/60 transition-colors">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">{views.length}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>Bu durumu kim gördü 👁️</SheetTitle>
            </SheetHeader>
            <div className="space-y-3 mt-4">
              {views.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Henüz görüntülenme yok</p>
              ) : (
                views.map((view) => (
                  <div key={view.id} className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={view.profiles.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {view.profiles.nickname[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{view.profiles.nickname}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(view.viewed_at).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}