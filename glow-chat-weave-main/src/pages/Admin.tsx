import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, AlertTriangle, FileText, Ban, UserX, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  pendingReports: number;
  totalReports: number;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reported_message_id: string | null;
  reported_status_id: string | null;
  reason_text: string;
  status: string;
  created_at: string;
  reporter?: { username: string; nickname: string; avatar_url: string | null };
  reported_user?: { username: string; nickname: string; avatar_url: string | null };
  message?: { content: string | null };
  status_content?: { content: string | null };
}

interface UserData {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
  last_seen: string | null;
}

interface AuditLog {
  id: string;
  action_type: string;
  target_type: string;
  created_at: string;
  admin?: { username: string; nickname: string };
  details: any;
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, activeUsers: 0, pendingReports: 0, totalReports: 0 });
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdminRole = roles?.some(r => r.role === "admin" || r.role === "moderator");

      if (!hasAdminRole) {
        toast({
          title: "Erişim Reddedildi",
          description: "Bu sayfaya erişim yetkiniz yok.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await loadDashboardData();
    } catch (error) {
      console.error("Admin check error:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      // Load stats
      const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const { count: activeUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_seen", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      const { count: pendingReports } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: totalReports } = await supabase.from("reports").select("*", { count: "exact", head: true });

      setStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        pendingReports: pendingReports || 0,
        totalReports: totalReports || 0,
      });

      // Load reports
      const { data: reportsData } = await supabase
        .from("reports")
        .select(`
          *,
          reporter:profiles!reports_reporter_id_fkey(username, nickname, avatar_url),
          reported_user:profiles!reports_reported_user_id_fkey(username, nickname, avatar_url),
          message:messages(content),
          status_content:statuses(content)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      setReports(reportsData || []);

      // Load users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      setUsers(usersData || []);

      // Load audit logs
      const { data: logsData } = await supabase
        .from("audit_logs")
        .select(`
          *,
          admin:profiles!audit_logs_admin_id_fkey(username, nickname)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      setAuditLogs(logsData || []);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    }
  };

  const handleReportAction = async (reportId: string, action: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      let actionDetails = { action, reportId, notes: actionNotes };

      // Execute action based on type
      if (action === "ban_user" && report.reported_user_id) {
        await supabase.from("user_bans").insert({
          user_id: report.reported_user_id,
          banned_by: user.id,
          reason: actionNotes || report.reason_text,
        });
      } else if (action === "suspend_user" && report.reported_user_id) {
        await supabase.from("user_suspensions").insert({
          user_id: report.reported_user_id,
          suspended_by: user.id,
          reason: actionNotes || report.reason_text,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } else if (action === "delete_message" && report.reported_message_id) {
        await supabase.from("messages").update({ is_deleted: true }).eq("id", report.reported_message_id);
      } else if (action === "delete_status" && report.reported_status_id) {
        await supabase.from("statuses").delete().eq("id", report.reported_status_id);
      }

      // Update report status
      await supabase
        .from("reports")
        .update({
          status: action === "dismiss" ? "dismissed" : "actioned",
          action_taken: action,
          admin_notes: actionNotes,
          assigned_admin_id: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      // Create audit log
      await supabase.from("audit_logs").insert({
        admin_id: user.id,
        action_type: action,
        target_type: "report",
        target_id: reportId,
        details: actionDetails,
      });

      toast({
        title: "İşlem Başarılı",
        description: "Rapor işleme alındı ve aksiyon uygulandı.",
      });

      setSelectedReport(null);
      setActionNotes("");
      await loadDashboardData();
    } catch (error) {
      console.error("Error handling report:", error);
      toast({
        title: "Hata",
        description: "İşlem gerçekleştirilemedi.",
        variant: "destructive",
      });
    }
  };

  const handleUserAction = async (userId: string, action: "ban" | "suspend") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const reason = prompt(`${action === "ban" ? "Ban" : "Suspend"} sebebi:`);
      if (!reason) return;

      if (action === "ban") {
        await supabase.from("user_bans").insert({
          user_id: userId,
          banned_by: user.id,
          reason,
        });
      } else {
        await supabase.from("user_suspensions").insert({
          user_id: userId,
          suspended_by: user.id,
          reason,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      await supabase.from("audit_logs").insert({
        admin_id: user.id,
        action_type: action,
        target_type: "user",
        target_id: userId,
        details: { reason },
      });

      toast({
        title: "İşlem Başarılı",
        description: `Kullanıcı ${action === "ban" ? "banlandı" : "askıya alındı"}.`,
      });

      await loadDashboardData();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Hata",
        description: "İşlem gerçekleştirilemedi.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Admin Panel</h1>
      </div>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Tüm admin işlemleri audit log'a kaydedilir. Kullanıcı şifreleri asla görüntülenemez - sadece şifre sıfırlama başlatılabilir.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Kullanıcı (24s)</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Rapor</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingReports}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Rapor</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReports}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reports" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reports">Raporlar ({stats.pendingReports})</TabsTrigger>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Henüz rapor yok
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Rapor #{report.id.slice(0, 8)}
                      </CardTitle>
                      <CardDescription>
                        {report.reporter?.nickname} tarafından {new Date(report.created_at).toLocaleString("tr-TR")}
                      </CardDescription>
                    </div>
                    <Badge variant={report.status === "pending" ? "destructive" : "secondary"}>
                      {report.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-1">Sebep:</p>
                    <p className="text-sm text-muted-foreground">{report.reason_text}</p>
                  </div>

                  {report.message?.content && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Bildirilen Mesaj:</p>
                      <p className="text-sm bg-muted p-2 rounded">{report.message.content}</p>
                    </div>
                  )}

                  {report.status_content?.content && (
                    <div>
                      <p className="text-sm font-semibold mb-1">Bildirilen Durum:</p>
                      <p className="text-sm bg-muted p-2 rounded">{report.status_content.content}</p>
                    </div>
                  )}

                  {report.status === "pending" && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Admin notu (opsiyonel)"
                        value={selectedReport?.id === report.id ? actionNotes : ""}
                        onChange={(e) => {
                          setSelectedReport(report);
                          setActionNotes(e.target.value);
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleReportAction(report.id, "dismiss")}>
                          Reddet
                        </Button>
                        {report.reported_message_id && (
                          <Button size="sm" variant="destructive" onClick={() => handleReportAction(report.id, "delete_message")}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Mesajı Sil
                          </Button>
                        )}
                        {report.reported_status_id && (
                          <Button size="sm" variant="destructive" onClick={() => handleReportAction(report.id, "delete_status")}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Durumu Sil
                          </Button>
                        )}
                        {report.reported_user_id && (
                          <>
                            <Button size="sm" variant="destructive" onClick={() => handleReportAction(report.id, "suspend_user")}>
                              <UserX className="w-4 h-4 mr-1" />
                              Kullanıcıyı Askıya Al (7 gün)
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReportAction(report.id, "ban_user")}>
                              <Ban className="w-4 h-4 mr-1" />
                              Kullanıcıyı Banla
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={user.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.username}
                      alt={user.nickname}
                      className="w-12 h-12 rounded-full"
                    />
                    <div>
                      <CardTitle>{user.nickname}</CardTitle>
                      <CardDescription>@{user.username}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleUserAction(user.id, "suspend")}>
                      <UserX className="w-4 h-4 mr-1" />
                      Askıya Al
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUserAction(user.id, "ban")}>
                      <Ban className="w-4 h-4 mr-1" />
                      Banla
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Kayıt:</p>
                    <p>{new Date(user.created_at).toLocaleDateString("tr-TR")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Son Görülme:</p>
                    <p>{user.last_seen ? new Date(user.last_seen).toLocaleString("tr-TR") : "Bilinmiyor"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="audit" className="space-y-2">
          {auditLogs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">
                      {log.admin?.nickname} - {log.action_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.target_type} • {new Date(log.created_at).toLocaleString("tr-TR")}
                    </p>
                  </div>
                  <Badge variant="outline">{log.action_type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
