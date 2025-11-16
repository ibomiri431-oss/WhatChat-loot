import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Search, Settings, LogOut, UserPlus, RadioTower } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface Chat {
  id: string;
  type: string;
  title: string | null;
  updated_at: string;
  other_user?: {
    id: string;
    username: string;
    nickname: string;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
  };
}

export default function Chats() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadChats();

    // Real-time subscription for new messages
    const channel = supabase
      .channel('chats-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const loadChats = async () => {
    if (!user) return;

    try {
      // Get chats user is part of
      const { data: chatParticipants, error: participantsError } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('user_id', user.id);

      if (participantsError) throw participantsError;

      const chatIds = chatParticipants?.map(cp => cp.chat_id) || [];

      if (chatIds.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Get chat details
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('*')
        .in('id', chatIds)
        .order('updated_at', { ascending: false });

      if (chatsError) throw chatsError;

      // For each chat, get other user and last message
      const chatsWithDetails = await Promise.all(
        (chatsData || []).map(async (chat) => {
          // Get other user
          const { data: participants } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('chat_id', chat.id)
            .neq('user_id', user.id)
            .single();

          let otherUser = null;
          if (participants) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', participants.user_id)
              .single();
            otherUser = profile;
          }

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          return {
            ...chat,
            other_user: otherUser,
            last_message: lastMessage
          };
        })
      );

      setChats(chatsWithDetails);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.other_user?.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.other_user?.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Sohbetler</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/status')}
            title="Durumlar"
          >
            <RadioTower className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/users')}
          >
            <UserPlus className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="p-4 bg-card border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Sohbet ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Yükleniyor...</div>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Sohbet bulunamadı' : 'Henüz sohbetiniz yok'}
            </p>
            <Button onClick={() => navigate('/users')}>
              <UserPlus className="w-4 h-4 mr-2" />
              Yeni Sohbet Başlat
            </Button>
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="p-4 border-b border-border hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={chat.other_user?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {chat.other_user?.nickname?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold truncate">
                      {chat.other_user?.nickname || 'Bilinmeyen'}
                    </h3>
                    {chat.last_message && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(chat.last_message.created_at), {
                          addSuffix: true,
                          locale: tr
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message?.content || 'Henüz mesaj yok'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
