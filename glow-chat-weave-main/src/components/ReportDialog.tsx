import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUserId?: string;
  reportedMessageId?: string;
  reportedStatusId?: string;
  reportType: "user" | "message" | "status";
}

export default function ReportDialog({
  open,
  onOpenChange,
  reportedUserId,
  reportedMessageId,
  reportedStatusId,
  reportType,
}: ReportDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const reasonOptions = {
    user: [
      { value: "spam", label: "Spam veya Aldatıcı İçerik" },
      { value: "harassment", label: "Taciz veya Zorbalık" },
      { value: "hate", label: "Nefret Söylemi" },
      { value: "violence", label: "Şiddet veya Tehdit" },
      { value: "impersonation", label: "Kimlik Taklidi" },
      { value: "other", label: "Diğer" },
    ],
    message: [
      { value: "spam", label: "Spam" },
      { value: "harassment", label: "Taciz" },
      { value: "inappropriate", label: "Uygunsuz İçerik" },
      { value: "violence", label: "Şiddet İçeriği" },
      { value: "other", label: "Diğer" },
    ],
    status: [
      { value: "spam", label: "Spam" },
      { value: "inappropriate", label: "Uygunsuz İçerik" },
      { value: "violence", label: "Şiddet İçeriği" },
      { value: "hate", label: "Nefret Söylemi" },
      { value: "other", label: "Diğer" },
    ],
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast({
        title: "Hata",
        description: "Lütfen bir sebep seçin.",
        variant: "destructive",
      });
      return;
    }

    if (selectedReason === "other" && !reason.trim()) {
      toast({
        title: "Hata",
        description: "Lütfen bir açıklama girin.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const reasonText = selectedReason === "other" 
        ? reason 
        : reasonOptions[reportType].find(r => r.value === selectedReason)?.label || reason;

      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId || null,
        reported_message_id: reportedMessageId || null,
        reported_status_id: reportedStatusId || null,
        reason_text: reasonText,
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Rapor Gönderildi",
        description: "Raporunuz incelenmek üzere alındı. Teşekkür ederiz.",
      });

      onOpenChange(false);
      setReason("");
      setSelectedReason("");
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Hata",
        description: "Rapor gönderilemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <DialogTitle>
              {reportType === "user" && "Kullanıcıyı Bildir"}
              {reportType === "message" && "Mesajı Bildir"}
              {reportType === "status" && "Durumu Bildir"}
            </DialogTitle>
          </div>
          <DialogDescription>
            Lütfen bildirme sebebinizi seçin. Raporunuz admin ekibi tarafından incelenecektir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Sebep Seçin</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {reasonOptions[reportType].map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {selectedReason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="reason">Açıklama</Label>
              <Textarea
                id="reason"
                placeholder="Lütfen durumu detaylı açıklayın..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Gönderiliyor..." : "Raporu Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
