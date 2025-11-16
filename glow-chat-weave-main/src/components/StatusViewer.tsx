import { useState, useEffect } from "react";
import { X, Trash2, Heart, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusViewsLikes } from "./StatusViewsLikes";
import { toast } from "sonner";
import ReportDialog from "./ReportDialog";

interface Status {
  id: string;
  type: 'text' | 'image' | 'video';
  content: string | null;
  media_url: string | null;
  background_color: string | null;
  created_at: string;
}

interface GroupedStatus {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  statuses: Status[];
}

interface StatusViewerProps {
  groupedStatus: GroupedStatus;
  onClose: () => void;
  onDelete?: (statusId: string) => void;
  onViewRecorded?: () => void;
}

export function StatusViewer({ groupedStatus, onClose, onDelete, onViewRecorded }: StatusViewerProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const currentStatus = groupedStatus.statuses[currentIndex];
  const duration = currentStatus?.type === 'video' ? 30000 : 5000; // 30s for video, 5s for others
  const isOwner = groupedStatus.user_id === user?.id;

  // Check if current status is liked
  useEffect(() => {
    if (!currentStatus || !user) return;
    
    const checkLikeStatus = async () => {
      const { data } = await supabase
        .from('status_likes' as any)
        .select('id')
        .eq('status_id', currentStatus.id)
        .eq('user_id', user.id)
        .single();
      
      setIsLiked(!!data);
    };
    
    checkLikeStatus();
  }, [currentStatus?.id, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Move to next status
          if (currentIndex < groupedStatus.statuses.length - 1) {
            setCurrentIndex(prev => prev + 1);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentIndex, groupedStatus.statuses.length, duration, onClose]);

  const handleNext = () => {
    if (currentIndex < groupedStatus.statuses.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const handleDelete = () => {
    if (onDelete && currentStatus) {
      onDelete(currentStatus.id);
    }
  };

  const handleLike = async () => {
    if (!user || !currentStatus) return;

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('status_likes' as any)
          .delete()
          .eq('status_id', currentStatus.id)
          .eq('user_id', user.id);
        
        setIsLiked(false);
      } else {
        // Like
        await supabase
          .from('status_likes' as any)
          .insert({
            status_id: currentStatus.id,
            user_id: user.id
          } as any);
        
        setIsLiked(true);
        toast.success('Beğendin ❤️');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Bir hata oluştu');
    }
  };

  if (!currentStatus) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-2">
        {groupedStatus.statuses.map((_, index) => (
          <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <Progress
              value={index === currentIndex ? progress : index < currentIndex ? 100 : 0}
              className="h-full"
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 z-10 flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2 text-white">
          <div className="text-sm font-semibold">{groupedStatus.nickname}</div>
          <div className="text-xs opacity-70">
            {new Date(currentStatus.created_at).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="h-full w-full flex items-center justify-center">
        {currentStatus.type === 'text' && (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ backgroundColor: currentStatus.background_color || '#128C7E' }}
          >
            <p className="text-white text-2xl text-center font-medium whitespace-pre-wrap">
              {currentStatus.content}
            </p>
          </div>
        )}

        {currentStatus.type === 'image' && currentStatus.media_url && (
          <img
            src={currentStatus.media_url}
            alt="Status"
            className="w-full h-full object-contain"
          />
        )}

        {currentStatus.type === 'video' && currentStatus.media_url && (
          <video
            src={currentStatus.media_url}
            className="w-full h-full object-contain"
            autoPlay
            muted
            playsInline
          />
        )}
      </div>

      {/* Like Button (not for owner) */}
      {!isOwner && (
        <div className="absolute bottom-20 right-4 z-10 flex flex-col gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLike}
            className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
          >
            <Heart 
              className="h-6 w-6" 
              fill={isLiked ? "currentColor" : "none"}
            />
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowReportDialog(true)}
            className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white"
          >
            <Flag className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Views and Likes Stats */}
      <StatusViewsLikes statusId={currentStatus.id} isOwner={isOwner} />

      {/* Navigation areas */}
      <div className="absolute inset-0 flex">
        <div className="flex-1" onClick={handlePrevious} />
        <div className="flex-1" onClick={handleNext} />
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <ReportDialog
          open={showReportDialog}
          onOpenChange={setShowReportDialog}
          reportType="status"
          reportedUserId={groupedStatus.user_id}
          reportedStatusId={currentStatus.id}
        />
      )}
    </div>
  );
}
