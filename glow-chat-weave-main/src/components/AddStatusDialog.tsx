import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Type, Image, Video, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AddStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusAdded: () => void;
}

const BACKGROUND_COLORS = [
  '#128C7E', // WhatsApp green
  '#075E54', // Dark green
  '#25D366', // Light green
  '#DCF8C6', // Light yellow
  '#34B7F1', // Blue
  '#EA4335', // Red
  '#FBBC04', // Yellow
  '#7B1FA2', // Purple
];

export function AddStatusDialog({ open, onOpenChange, onStatusAdded }: AddStatusDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(BACKGROUND_COLORS[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Sadece resim veya video yükleyebilirsiniz');
      return;
    }

    if (isVideo && file.size > 50 * 1024 * 1024) { // 50MB limit for video
      toast.error('Video maksimum 50MB olabilir');
      return;
    }

    if (isImage && file.size > 10 * 1024 * 1024) { // 10MB limit for image
      toast.error('Resim maksimum 10MB olabilir');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadMedia = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('status-media')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('status-media')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const handleSubmitText = async () => {
    if (!textContent.trim()) {
      toast.error('Lütfen bir metin girin');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('statuses' as any)
        .insert({
          user_id: user!.id,
          type: 'text',
          content: textContent,
          background_color: selectedColor
        } as any);

      if (error) throw error;

      toast.success('Durum başarıyla paylaşıldı ✅');
      setTextContent('');
      onStatusAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding text status:', error);
      toast.error('Durum eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMedia = async () => {
    if (!selectedFile) {
      toast.error('Lütfen bir dosya seçin');
      return;
    }

    setLoading(true);
    try {
      const mediaUrl = await uploadMedia(selectedFile);
      const mediaType = selectedFile.type.startsWith('image/') ? 'image' : 'video';

      const { error } = await supabase
        .from('statuses' as any)
        .insert({
          user_id: user!.id,
          type: mediaType,
          media_url: mediaUrl
        } as any);

      if (error) throw error;

      toast.success('Durum başarıyla paylaşıldı ✅');
      setSelectedFile(null);
      setPreviewUrl(null);
      onStatusAdded();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding media status:', error);
      toast.error('Durum eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Durum Ekle</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text">
              <Type className="h-4 w-4 mr-2" />
              Metin
            </TabsTrigger>
            <TabsTrigger value="image">
              <Image className="h-4 w-4 mr-2" />
              Resim
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4 mr-2" />
              Video
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <Textarea
              placeholder="Durumunuzu yazın..."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="min-h-32"
              maxLength={500}
            />
            
            <div>
              <p className="text-sm text-muted-foreground mb-2">Arka plan rengi:</p>
              <div className="flex gap-2 flex-wrap">
                {BACKGROUND_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      selectedColor === color ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Button 
              onClick={handleSubmitText} 
              disabled={loading || !textContent.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Paylaş
            </Button>
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button variant="outline" className="w-full" asChild>
                  <span>Resim Seç</span>
                </Button>
              </label>
            </div>

            {previewUrl && (
              <div className="rounded-lg overflow-hidden">
                <img src={previewUrl} alt="Preview" className="w-full h-48 object-cover" />
              </div>
            )}

            <Button 
              onClick={handleSubmitMedia} 
              disabled={loading || !selectedFile}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Paylaş
            </Button>
          </TabsContent>

          <TabsContent value="video" className="space-y-4">
            <div>
              <input
                type="file"
                accept="video/mp4,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload">
                <Button variant="outline" className="w-full" asChild>
                  <span>Video Seç (Max 30 sn)</span>
                </Button>
              </label>
            </div>

            {previewUrl && (
              <div className="rounded-lg overflow-hidden">
                <video src={previewUrl} className="w-full h-48 object-cover" controls />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              * Maksimum video süresi 30 saniyedir
            </p>

            <Button 
              onClick={handleSubmitMedia} 
              disabled={loading || !selectedFile}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Paylaş
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
