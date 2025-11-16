import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, Mic, X, FileText, Video, Volume2, MoreVertical, Flag } from 'lucide-react';
import ReportDialog from '@/components/ReportDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { uploadMedia, formatFileSize } from '@/lib/mediaUpload';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
}

interface Profile {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
}

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (!user || !chatId) {
      navigate('/auth');
      return;
    }

    loadChatData();

    // Real-time subscription for new messages
    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user, navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatData = async () => {
    if (!chatId || !user) return;

    try {
      // Get other user
      const { data: participants } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', user.id)
        .single();

      if (participants) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', participants.user_id)
          .single();
        
        setOtherUser(profile);
      }

      // Load messages
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      setMessages(messagesData || []);
    } catch (error) {
      console.error('Error loading chat:', error);
      toast.error('Sohbet yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Mesaj gönderilemedi');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !chatId) return;

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Dosya boyutu 20MB\'dan küçük olmalıdır');
      return;
    }

    setUploading(true);
    try {
      const { url, type } = await uploadMedia(file, user.id);

      const { error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          content: type === 'file' ? file.name : null,
          media_url: url,
          media_type: type
        });

      if (error) throw error;

      toast.success('Medya gönderildi');
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Medya yüklenemedi');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleVoiceRecording = async () => {
    if (!isRecording) {
      try {
        await startRecording();
      } catch (error) {
        toast.error('Mikrofon erişimi reddedildi');
      }
    } else {
      try {
        setUploading(true);
        const audioBlob = await stopRecording();
        
        if (audioBlob.size === 0 || !user || !chatId) return;

        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        const { url, type } = await uploadMedia(audioFile, user.id);

        const { error } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            sender_id: user.id,
            content: 'Sesli mesaj',
            media_url: url,
            media_type: type
          });

        if (error) throw error;

        toast.success('Sesli mesaj gönderildi');
      } catch (error) {
        console.error('Error sending voice message:', error);
        toast.error('Sesli mesaj gönderilemedi');
      } finally {
        setUploading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-chat-bg">
      {/* Header */}
      <header className="bg-card border-b border-border p-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/chats')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={otherUser?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {otherUser?.nickname?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{otherUser?.nickname || 'Bilinmeyen'}</h2>
          <p className="text-xs text-muted-foreground">@{otherUser?.username}</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Henüz mesaj yok. İlk mesajı gönderin!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isSent = message.sender_id === user?.id;
            return (
              <div
                key={message.id}
                className={`flex ${isSent ? 'justify-end' : 'justify-start'} group`}
              >
                <div className="flex items-start gap-2 max-w-[80%]">
                  <div
                    className={`flex-1 rounded-2xl px-4 py-2 ${
                      isSent
                        ? 'bg-chat-sent text-primary-foreground rounded-br-sm'
                        : 'bg-chat-received text-foreground rounded-bl-sm'
                    }`}
                  >
                    {message.media_url && (
                      <div className="mb-2">
                        {message.media_type === 'image' && (
                          <img
                            src={message.media_url}
                            alt="Resim"
                            className="rounded-lg max-w-full max-h-96 object-cover cursor-pointer"
                            onClick={() => window.open(message.media_url!, '_blank')}
                          />
                        )}
                        {message.media_type === 'video' && (
                          <video
                            src={message.media_url}
                            controls
                            className="rounded-lg max-w-full max-h-96"
                          />
                        )}
                        {message.media_type === 'audio' && (
                          <div className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg">
                            <Volume2 className="w-4 h-4" />
                            <audio src={message.media_url} controls className="flex-1" />
                          </div>
                        )}
                        {message.media_type === 'file' && (
                          <a
                            href={message.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-secondary/20 rounded-lg hover:bg-secondary/30 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm underline">Dosyayı aç</span>
                          </a>
                        )}
                      </div>
                    )}
                    {message.content && (
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    )}
                    <p
                      className={`text-xs mt-1 ${
                        isSent ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                        locale: tr
                      })}
                    </p>
                  </div>
                  
                  {!isSent && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setReportingMessage(message)}>
                          <Flag className="mr-2 h-4 w-4" />
                          Bildir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 bg-card border-t border-border">
        {isRecording ? (
          <div className="flex items-center gap-3 bg-destructive/10 p-3 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium">{recordingTime}</span>
              <span className="text-xs text-muted-foreground">Kaydediliyor...</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={cancelRecording}
              className="text-muted-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
            <Button
              type="button"
              size="icon"
              onClick={handleVoiceRecording}
              disabled={uploading}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input
              placeholder={uploading ? "Yükleniyor..." : "Mesaj yazın..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-secondary/50"
              disabled={uploading}
            />
            {newMessage.trim() ? (
              <Button
                type="submit"
                size="icon"
                disabled={uploading}
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleVoiceRecording}
                disabled={uploading}
                className="bg-primary hover:bg-primary/90"
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        onChange={handleFileSelect}
      />

      {/* Report Dialog */}
      {reportingMessage && (
        <ReportDialog
          open={!!reportingMessage}
          onOpenChange={(open) => !open && setReportingMessage(null)}
          reportType="message"
          reportedUserId={reportingMessage.sender_id}
          reportedMessageId={reportingMessage.id}
        />
      )}
    </div>
  );
}
