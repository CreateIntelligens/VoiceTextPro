import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AdminLogs } from '@/components/admin-logs';
import {
  Users,
  UserPlus,
  Check,
  X,
  Clock,
  Mail,
  Calendar,
  Shield,
  AlertTriangle,
  Bug,
  FileAudio,
  Trash2,
  Eye,
  Edit,
  Crown,
  Loader2,
  Settings,
  Gauge,
  Save
} from 'lucide-react';

interface DefaultLimits {
  weeklyAudioMinutes: number;
  monthlyAudioMinutes: number;
  dailyTranscriptionCount: number;
  weeklyTranscriptionCount: number;
  maxFileSizeMb: number;
  totalStorageMb: number;
}

interface UserUsage {
  daily: { transcriptionCount: number; limit: number; percentage: number };
  weekly: {
    audioMinutes: number;
    transcriptionCount: number;
    limits: { audioMinutes: number; transcriptionCount: number };
    percentage: { audioMinutes: number; transcriptionCount: number };
  };
  monthly: { audioMinutes: number; limit: number; percentage: number };
  storage: { usedMb: number; limitMb: number; percentage: number };
}

interface Application {
  id: number;
  email: string;
  name: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt: string | null;
}

interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface AdminTranscription {
  id: number;
  userId: number | null;
  username: string | null;
  userEmail: string | null;
  filename: string;
  originalName: string;
  displayName: string | null;
  fileSize: number;
  status: string;
  progress: number;
  duration: number | null;
  wordCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [transcriptions, setTranscriptions] = useState<AdminTranscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [transcriptionsLoading, setTranscriptionsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<User | null>(null);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [activeTab, setActiveTab] = useState<'applications' | 'users' | 'transcriptions' | 'logs' | 'settings'>('applications');
  const { toast } = useToast();

  // Settings State
  const [registrationMode, setRegistrationMode] = useState<'open' | 'application'>('application');
  const [defaultLimits, setDefaultLimits] = useState<DefaultLimits>({
    weeklyAudioMinutes: 300,
    monthlyAudioMinutes: 1000,
    dailyTranscriptionCount: 10,
    weeklyTranscriptionCount: 50,
    maxFileSizeMb: 500,
    totalStorageMb: 5000
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedUserForLimits, setSelectedUserForLimits] = useState<User | null>(null);
  const [userLimitsDialog, setUserLimitsDialog] = useState(false);
  const [userLimits, setUserLimits] = useState<DefaultLimits | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchData();
      fetchTranscriptions();
      fetchSettings();
    }
  }, [isAuthenticated, user]);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const [modeRes, limitsRes] = await Promise.all([
        fetch('/api/admin/settings/registration-mode', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/default-limits', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (modeRes.ok) {
        const modeData = await modeRes.json();
        setRegistrationMode(modeData.mode);
      }

      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        setDefaultLimits(limitsData);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const saveRegistrationMode = async (mode: 'open' | 'application') => {
    setSavingSettings(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/settings/registration-mode', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      if (response.ok) {
        setRegistrationMode(mode);
        toast({ title: "設定已儲存", description: `註冊模式已切換為${mode === 'open' ? '開放註冊' : '申請制'}` });
      }
    } catch (error) {
      toast({ title: "儲存失敗", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const saveDefaultLimits = async () => {
    setSavingSettings(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/default-limits', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultLimits)
      });

      if (response.ok) {
        toast({ title: "設定已儲存", description: "預設限制已更新" });
      }
    } catch (error) {
      toast({ title: "儲存失敗", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const openUserLimitsDialog = async (u: User) => {
    setSelectedUserForLimits(u);
    setUserLimitsDialog(true);
    setUserLimits(null);
    setUserUsage(null);

    try {
      const token = localStorage.getItem('auth_token');
      const [limitsRes, usageRes] = await Promise.all([
        fetch(`/api/admin/users/${u.id}/limits`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/admin/users/${u.id}/usage`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (limitsRes.ok) {
        const data = await limitsRes.json();
        setUserLimits(data);
      }

      if (usageRes.ok) {
        const data = await usageRes.json();
        setUserUsage(data);
      }
    } catch (error) {
      console.error('Failed to fetch user limits:', error);
    }
  };

  const saveUserLimits = async () => {
    if (!selectedUserForLimits || !userLimits) return;

    setSavingSettings(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/users/${selectedUserForLimits.id}/limits`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limits: userLimits })
      });

      if (response.ok) {
        toast({ title: "用戶限制已更新" });
        setUserLimitsDialog(false);
      }
    } catch (error) {
      toast({ title: "儲存失敗", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const resetUserLimits = async () => {
    if (!selectedUserForLimits) return;

    setSavingSettings(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/users/${selectedUserForLimits.id}/limits`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast({ title: "已恢復預設限制" });
        setUserLimitsDialog(false);
      }
    } catch (error) {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const [applicationsRes, usersRes] = await Promise.all([
        fetch('/api/admin/applications', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (applicationsRes.ok && usersRes.ok) {
        const [applicationsData, usersData] = await Promise.all([
          applicationsRes.json(),
          usersRes.json()
        ]);
        setApplications(applicationsData);
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast({ title: "載入失敗", description: "無法載入管理數據", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscriptions = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/transcriptions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTranscriptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transcriptions:', error);
    } finally {
      setTranscriptionsLoading(false);
    }
  };

  const handleEditUser = async (userId: number, updates: { role?: string; status?: string; name?: string }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchData();
        setEditingUser(null);
        toast({ title: "更新成功", description: "用戶資訊已更新" });
      }
    } catch (error) {
      toast({ title: "更新失敗", description: "無法更新用戶資訊", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchData();
        setShowDeleteDialog(null);
        toast({ title: "刪除成功", description: "用戶已被刪除" });
      }
    } catch (error) {
      toast({ title: "刪除失敗", description: "無法刪除用戶", variant: "destructive" });
    }
  };

  const handleApproveApplication = async (applicationId: number) => {
    if (!newPassword) {
      toast({ title: "密碼不能為空", description: "請為新用戶設定密碼", variant: "destructive" });
      return;
    }

    setProcessingId(applicationId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });

      if (response.ok) {
        toast({ title: "帳號已開通", description: "用戶帳號已成功創建" });
        setNewPassword('');
        fetchData();
      }
    } catch (error) {
      toast({ title: "開通失敗", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectApplication = async (applicationId: number) => {
    setProcessingId(applicationId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast({ title: "申請已拒絕" });
        fetchData();
      }
    } catch (error) {
      toast({ title: "操作失敗", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName) {
      toast({ title: "請填寫所有必填欄位", variant: "destructive" });
      return;
    }

    setCreatingUser(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName,
          role: newUserRole,
          password: newUserPassword || undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "用戶創建成功",
          description: result.temporaryPassword ? `臨時密碼：${result.temporaryPassword}` : "帳號已創建"
        });
        setShowCreateUserDialog(false);
        setNewUserEmail('');
        setNewUserName('');
        setNewUserRole('user');
        setNewUserPassword('');
        fetchData();
      }
    } catch (error) {
      toast({ title: "創建失敗", variant: "destructive" });
    } finally {
      setCreatingUser(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">存取被拒絕</h3>
          <p className="text-sm text-muted-foreground">您沒有權限存取此頁面</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const pendingApplications = applications.filter(app => app.status === 'pending');

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-foreground">管理員面板</h1>
          <p className="text-sm text-muted-foreground mt-1">用戶管理和系統設定</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
            <div className="text-xl font-semibold text-amber-500">{pendingApplications.length}</div>
            <p className="text-[10px] text-muted-foreground">待處理</p>
          </div>
          <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
            <div className="text-xl font-semibold text-primary">{users.length}</div>
            <p className="text-[10px] text-muted-foreground">用戶數</p>
          </div>
          <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
            <div className="text-xl font-semibold text-emerald-500">{users.filter(u => u.status === 'active').length}</div>
            <p className="text-[10px] text-muted-foreground">啟用</p>
          </div>
          <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
            <div className="text-xl font-semibold text-secondary">{users.filter(u => u.role === 'admin').length}</div>
            <p className="text-[10px] text-muted-foreground">管理員</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 mb-4 bg-muted/30 rounded-xl overflow-x-auto">
          {(['applications', 'users', 'transcriptions', 'logs', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'applications' ? '申請' : tab === 'users' ? '用戶' : tab === 'transcriptions' ? '資料' : tab === 'logs' ? '日誌' : '設定'}
            </button>
          ))}
        </div>

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="space-y-4">
            {pendingApplications.length > 0 ? (
              pendingApplications.map((app) => (
                <div key={app.id} className="p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{app.email}</span>
                      </div>
                      {app.name && <p className="text-xs text-muted-foreground mt-1">{app.name}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(app.appliedAt).toLocaleDateString('zh-TW')}
                    </span>
                  </div>

                  {app.reason && (
                    <p className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 mb-3">
                      {app.reason}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      placeholder="設定密碼"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="flex-1 h-8 text-xs rounded-lg"
                    />
                    <Button
                      onClick={() => handleApproveApplication(app.id)}
                      disabled={processingId === app.id || !newPassword}
                      size="sm"
                      className="h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleRejectApplication(app.id)}
                      disabled={processingId === app.id}
                      size="sm"
                      className="h-8 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <UserPlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">沒有待處理的申請</p>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 rounded-lg">
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    新增用戶
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>新增用戶帳號</DialogTitle>
                    <DialogDescription>為平台新增用戶帳號</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    <Input placeholder="電子郵件" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className="rounded-lg" />
                    <Input placeholder="姓名" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="rounded-lg" />
                    <Select value={newUserRole} onValueChange={setNewUserRole}>
                      <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">一般用戶</SelectItem>
                        <SelectItem value="admin">管理員</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="password" placeholder="密碼（選填）" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="rounded-lg" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateUserDialog(false)} className="rounded-lg">取消</Button>
                    <Button onClick={handleCreateUser} disabled={!newUserEmail || !newUserName || creatingUser} className="rounded-lg">
                      {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : '創建'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {users.map((u) => (
              <div key={u.id} className="p-4 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${u.role === 'admin' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                      {u.role === 'admin' ? <Crown className="w-4 h-4 text-amber-500" /> : <Users className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name || u.email}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${u.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                      {u.status === 'active' ? '啟用' : '停用'}
                    </span>
                    <button
                      onClick={() => openUserLimitsDialog(u)}
                      className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                      title="使用量/限制"
                    >
                      <Gauge className="w-3.5 h-3.5" />
                    </button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button onClick={() => setEditingUser(u)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>編輯用戶</DialogTitle>
                          <DialogDescription>{u.email}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          <Select defaultValue={u.role} onValueChange={(role) => handleEditUser(u.id, { role })}>
                            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">一般用戶</SelectItem>
                              <SelectItem value="admin">管理員</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select defaultValue={u.status} onValueChange={(status) => handleEditUser(u.id, { status })}>
                            <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">啟用</SelectItem>
                              <SelectItem value="inactive">停用</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <button
                      onClick={() => setShowDeleteDialog(u)}
                      disabled={u.id === user?.id}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <AlertDialog open={showDeleteDialog?.id === u.id} onOpenChange={() => setShowDeleteDialog(null)}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>確認刪除</AlertDialogTitle>
                      <AlertDialogDescription>確定要刪除用戶 "{u.name || u.email}" 嗎？此操作無法復原。</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive hover:bg-destructive/90 rounded-lg">刪除</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {/* Transcriptions Tab */}
        {activeTab === 'transcriptions' && (
          <div className="space-y-3">
            {transcriptionsLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              </div>
            ) : transcriptions.length === 0 ? (
              <div className="py-12 text-center">
                <FileAudio className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">沒有轉錄資料</p>
              </div>
            ) : (
              transcriptions.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-card/50 border border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.displayName || t.originalName}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {t.userEmail || '未知'} · {t.wordCount ? `${t.wordCount}字` : ''} · {new Date(t.createdAt).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      t.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                      t.status === 'error' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && <AdminLogs />}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Registration Mode */}
            <div className="p-4 rounded-xl bg-card/50 border border-border/50">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                註冊模式
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => saveRegistrationMode('open')}
                  disabled={savingSettings}
                  className={`p-3 rounded-lg text-xs font-medium transition-all ${
                    registrationMode === 'open'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  開放註冊
                  <p className="text-[10px] opacity-70 mt-0.5">用戶可自行註冊並驗證 Email</p>
                </button>
                <button
                  onClick={() => saveRegistrationMode('application')}
                  disabled={savingSettings}
                  className={`p-3 rounded-lg text-xs font-medium transition-all ${
                    registrationMode === 'application'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  申請制
                  <p className="text-[10px] opacity-70 mt-0.5">用戶需驗證後等待管理員審核</p>
                </button>
              </div>
            </div>

            {/* Default Limits */}
            <div className="p-4 rounded-xl bg-card/50 border border-border/50">
              <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                預設使用限制
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground">每週音頻（分鐘）</label>
                  <Input
                    type="number"
                    value={defaultLimits.weeklyAudioMinutes}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, weeklyAudioMinutes: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">每月音頻（分鐘）</label>
                  <Input
                    type="number"
                    value={defaultLimits.monthlyAudioMinutes}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, monthlyAudioMinutes: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">每日轉錄次數</label>
                  <Input
                    type="number"
                    value={defaultLimits.dailyTranscriptionCount}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, dailyTranscriptionCount: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">每週轉錄次數</label>
                  <Input
                    type="number"
                    value={defaultLimits.weeklyTranscriptionCount}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, weeklyTranscriptionCount: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">單檔大小上限（MB）</label>
                  <Input
                    type="number"
                    value={defaultLimits.maxFileSizeMb}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, maxFileSizeMb: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">總儲存空間（MB）</label>
                  <Input
                    type="number"
                    value={defaultLimits.totalStorageMb}
                    onChange={(e) => setDefaultLimits({ ...defaultLimits, totalStorageMb: parseInt(e.target.value) || 0 })}
                    className="h-8 text-xs rounded-lg mt-1"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveDefaultLimits} disabled={savingSettings} size="sm" className="h-8 rounded-lg">
                  {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  儲存
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* User Limits Dialog */}
        <Dialog open={userLimitsDialog} onOpenChange={setUserLimitsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>用戶使用量和限制</DialogTitle>
              <DialogDescription>{selectedUserForLimits?.email}</DialogDescription>
            </DialogHeader>
            {userUsage && userLimits ? (
              <div className="space-y-4 py-2">
                {/* Usage Stats */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">目前使用量</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">今日轉錄</p>
                      <p className="text-sm font-medium">{userUsage.daily.transcriptionCount} / {userUsage.daily.limit}</p>
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, userUsage.daily.percentage)}%` }} />
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">本週音頻</p>
                      <p className="text-sm font-medium">{userUsage.weekly.audioMinutes} / {userUsage.weekly.limits.audioMinutes} 分</p>
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, userUsage.weekly.percentage.audioMinutes)}%` }} />
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">本月音頻</p>
                      <p className="text-sm font-medium">{userUsage.monthly.audioMinutes} / {userUsage.monthly.limit} 分</p>
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, userUsage.monthly.percentage)}%` }} />
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">儲存空間</p>
                      <p className="text-sm font-medium">{userUsage.storage.usedMb} / {userUsage.storage.limitMb} MB</p>
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, userUsage.storage.percentage)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Limits */}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">自訂限制（留空則使用預設）</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">每週音頻（分鐘）</label>
                      <Input
                        type="number"
                        value={userLimits.weeklyAudioMinutes}
                        onChange={(e) => setUserLimits({ ...userLimits, weeklyAudioMinutes: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">每月音頻（分鐘）</label>
                      <Input
                        type="number"
                        value={userLimits.monthlyAudioMinutes}
                        onChange={(e) => setUserLimits({ ...userLimits, monthlyAudioMinutes: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">每日轉錄次數</label>
                      <Input
                        type="number"
                        value={userLimits.dailyTranscriptionCount}
                        onChange={(e) => setUserLimits({ ...userLimits, dailyTranscriptionCount: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">每週轉錄次數</label>
                      <Input
                        type="number"
                        value={userLimits.weeklyTranscriptionCount}
                        onChange={(e) => setUserLimits({ ...userLimits, weeklyTranscriptionCount: parseInt(e.target.value) || 0 })}
                        className="h-8 text-xs rounded-lg mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={resetUserLimits} disabled={savingSettings} className="h-8 rounded-lg">
                    恢復預設
                  </Button>
                  <Button size="sm" onClick={saveUserLimits} disabled={savingSettings} className="h-8 rounded-lg">
                    {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    儲存
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
