import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StatusViewer } from "@/components/StatusViewer";
import { AddStatusDialog } from "@/components/AddStatusDialog";

interface Status {
  id: string;
  user_id: string;
  type: 'text' | 'image' | 'video';
  content: string | null;
  media_url: string | null;
  background_color: string | null;
  created_at: string;
  expires_at: string;
  profiles: {
    username: string;
    nickname: string;
    avatar_url: string | null;
  };
  view_count?: number;
}

interface GroupedStatus {
  user_id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  statuses: Status[];
  hasUnviewed: boolean;
}

export default function Status() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<GroupedStatus[]>([]);
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<GroupedStatus | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadStatuses();
    setupRealtimeListener();
  }, [user]);

  const loadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('statuses' as any)
        .select(`
          *,
          profiles:user_id (username, nickname, avatar_url)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading statuses:', error);
        throw error;
      }

      // Group statuses by user
      const grouped: { [key: string]: GroupedStatus } = {};
      const myStatusList: Status[] = [];

      for (const status of data || []) {
        const statusData = status as any;
        if (statusData.user_id === user.id) {
          myStatusList.push(statusData);
        } else {
          if (!grouped[statusData.user_id]) {
            grouped[statusData.user_id] = {
              user_id: statusData.user_id,
              username: statusData.profiles.username,
              nickname: statusData.profiles.nickname,
              avatar_url: statusData.profiles.avatar_url,
              statuses: [],
              hasUnviewed: false
            };
          }
          grouped[statusData.user_id].statuses.push(statusData);
        }
      }

      // Check for unviewed statuses
      for (const userId in grouped) {
        const { data: views } = await supabase
          .from('status_views' as any)
          .select('status_id')
          .eq('viewer_id', user.id)
          .in('status_id', grouped[userId].statuses.map(s => s.id));

        const viewedIds = new Set((views as any)?.map((v: any) => v.status_id) || []);
        grouped[userId].hasUnviewed = grouped[userId].statuses.some(s => !viewedIds.has(s.id));
      }

      setStatuses(Object.values(grouped));
      setMyStatuses(myStatusList);
    } catch (error) {
      console.error('Error loading statuses:', error);
      toast.error('Durumlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeListener = () => {
    const channel = supabase
      .channel('statuses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'statuses' as any
        },
        () => {
          loadStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleStatusClick = async (groupedStatus: GroupedStatus) => {
    setSelectedStatus(groupedStatus);
    
    // Mark as viewed for first status immediately
    if (groupedStatus.statuses.length > 0) {
      try {
        await supabase
          .from('status_views' as any)
          .upsert({
            status_id: groupedStatus.statuses[0].id,
            viewer_id: user!.id
          } as any, {
            onConflict: 'status_id,viewer_id'
          });
      } catch (error) {
        console.error('Error recording view:', error);
      }
    }
  };

  const handleViewRecorded = async () => {
    // This can be called when status changes in viewer
    if (selectedStatus) {
      await loadStatuses(); // Refresh to update view counts
    }
  };

  const handleMyStatusClick = () => {
    if (myStatuses.length > 0) {
      setSelectedStatus({
        user_id: user!.id,
        username: 'Sen',
        nickname: 'Sen',
        avatar_url: null,
        statuses: myStatuses,
        hasUnviewed: false
      });
    }
  };

  const handleDeleteStatus = async (statusId: string) => {
    try {
      const { error } = await supabase
        .from('statuses' as any)
        .delete()
        .eq('id', statusId);

      if (error) throw error;

      toast.success('Durum silindi');
      setMyStatuses(prev => prev.filter(s => s.id !== statusId));
      setSelectedStatus(null);
    } catch (error) {
      console.error('Error deleting status:', error);
      toast.error('Durum silinemedi');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/chats')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Durumlar</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* My Status */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-14 w-14 cursor-pointer" onClick={handleMyStatusClick}>
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.user_metadata?.nickname?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Durumum</p>
              <p className="text-sm text-muted-foreground">
                {myStatuses.length > 0 ? 'Görüntülemek için tıkla' : 'Durum eklemek için tıkla'}
              </p>
            </div>
          </div>
        </div>

        {/* Recent Updates */}
        {statuses.length > 0 && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-3">Son güncellemeler</p>
            <div className="space-y-3">
              {statuses.map((grouped) => (
                <div
                  key={grouped.user_id}
                  className="flex items-center gap-3 cursor-pointer active:bg-accent/50 p-2 rounded-lg transition-colors"
                  onClick={() => handleStatusClick(grouped)}
                >
                  <div className={`relative ${grouped.hasUnviewed ? 'ring-2 ring-primary rounded-full' : ''}`}>
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={grouped.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {grouped.nickname[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{grouped.nickname}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(grouped.statuses[0].created_at).toLocaleTimeString('tr-TR', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {statuses.length === 0 && myStatuses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-2">Henüz durum yok</p>
            <p className="text-sm text-muted-foreground">İlk durumu sen ekle!</p>
          </div>
        )}
      </div>

      {/* Status Viewer */}
      {selectedStatus && (
        <StatusViewer
          groupedStatus={selectedStatus}
          onClose={() => setSelectedStatus(null)}
          onDelete={selectedStatus.user_id === user?.id ? handleDeleteStatus : undefined}
          onViewRecorded={handleViewRecorded}
        />
      )}

      {/* Add Status Dialog */}
      <AddStatusDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onStatusAdded={loadStatuses}
      />
    </div>
  );
}
