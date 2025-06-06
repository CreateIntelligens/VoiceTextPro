import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Download,
  Edit,
  UserCog,
  Crown
} from 'lucide-react';

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
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      fetchData();
      fetchTranscriptions();
    }
  }, [isAuthenticated, user]);

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
      toast({
        title: "載入失敗",
        description: "無法載入管理數據",
        variant: "destructive",
      });
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
      } else {
        throw new Error('Failed to fetch transcriptions');
      }
    } catch (error) {
      console.error('Failed to fetch transcriptions:', error);
      toast({
        title: "載入失敗",
        description: "無法載入轉錄資料",
        variant: "destructive",
      });
    } finally {
      setTranscriptionsLoading(false);
    }
  };

  const handleEditUser = async (userId: number, updates: { role?: string; status?: string; name?: string }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await fetchData();
        setEditingUser(null);
        toast({
          title: "更新成功",
          description: "用戶資訊已更新",
        });
      } else {
        throw new Error('Failed to update user');
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast({
        title: "更新失敗",
        description: "無法更新用戶資訊",
        variant: "destructive",
      });
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
        toast({
          title: "刪除成功",
          description: "用戶已被刪除",
        });
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast({
        title: "刪除失敗",
        description: "無法刪除用戶",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = (role: string) => {
    if (editingUser) {
      handleEditUser(editingUser.id, { role });
    }
  };

  const handleStatusChange = (status: string) => {
    if (editingUser) {
      handleEditUser(editingUser.id, { status });
    }
  };

  const handleApproveApplication = async (applicationId: number) => {
    if (!newPassword) {
      toast({
        title: "密碼不能為空",
        description: "請為新用戶設定密碼",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(applicationId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/admin/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPassword })
      });

      if (response.ok) {
        toast({
          title: "帳號已開通",
          description: "用戶帳號已成功創建",
        });
        setNewPassword('');
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      toast({
        title: "開通失敗",
        description: error instanceof Error ? error.message : "無法開通帳號",
        variant: "destructive",
      });
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
        toast({
          title: "申請已拒絕",
          description: "申請已被拒絕",
        });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error.message);
      }
    } catch (error) {
      toast({
        title: "操作失敗",
        description: error instanceof Error ? error.message : "無法拒絕申請",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />待處理</Badge>;
      case 'approved':
        return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />已批准</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />已拒絕</Badge>;
      case 'active':
        return <Badge className="bg-green-600">啟用</Badge>;
      case 'suspended':
        return <Badge variant="destructive">停用</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">存取被拒絕</h3>
              <p className="text-gray-600">您沒有權限存取此頁面</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">載入管理面板...</p>
        </div>
      </div>
    );
  }

  const pendingApplications = applications.filter(app => app.status === 'pending');

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">管理員面板</h1>
          <p className="text-sm sm:text-base text-gray-600">管理用戶帳號、申請和系統日誌</p>
        </div>

        <Tabs defaultValue="applications" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="applications" className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              申請管理
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              用戶管理
            </TabsTrigger>
            <TabsTrigger value="transcriptions" className="flex items-center gap-2">
              <FileAudio className="w-4 h-4" />
              轉錄管理
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              系統日誌
            </TabsTrigger>
          </TabsList>

          <TabsContent value="applications" className="mt-6">
            {/* Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">待處理申請</CardTitle>
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{pendingApplications.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">總用戶數</CardTitle>
              <Users className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{users.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">啟用用戶</CardTitle>
              <UserPlus className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {users.filter(u => u.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">管理員</CardTitle>
              <Shield className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {users.filter(u => u.role === 'admin').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Applications */}
        {pendingApplications.length > 0 && (
          <Card className="mb-6 sm:mb-8">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <UserPlus className="w-5 h-5 mr-2 text-orange-600" />
                待處理申請 ({pendingApplications.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="space-y-4">
                {pendingApplications.map((application) => (
                  <div key={application.id} className="border rounded-lg p-3 sm:p-4 bg-white">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center mb-2">
                        <div className="flex items-center mb-2 sm:mb-0">
                          <Mail className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="font-medium text-sm sm:text-base break-all">{application.email}</span>
                        </div>
                        {application.name && (
                          <span className="text-gray-500 text-sm sm:ml-2">({application.name})</span>
                        )}
                      </div>
                      
                      <div className="flex items-center text-xs sm:text-sm text-gray-500">
                        <Calendar className="w-4 h-4 mr-1" />
                        申請時間：{new Date(application.appliedAt).toLocaleString('zh-TW')}
                      </div>
                      
                      {application.reason && (
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs sm:text-sm"><strong>申請理由：</strong>{application.reason}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <Input
                          type="password"
                          placeholder="為新用戶設定密碼"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full sm:max-w-xs"
                        />
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => handleApproveApplication(application.id)}
                            disabled={processingId === application.id || !newPassword}
                            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                            size="sm"
                          >
                            {processingId === application.id ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            ) : (
                              <Check className="w-4 h-4 mr-2" />
                            )}
                            批准
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleRejectApplication(application.id)}
                            disabled={processingId === application.id}
                            className="flex-1 sm:flex-none"
                            size="sm"
                          >
                            <X className="w-4 h-4 mr-2" />
                            拒絕
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

            {/* Users List */}
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center text-lg sm:text-xl">
                  <Users className="w-5 h-5 mr-2 text-blue-600" />
                  用戶列表 ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
            {/* Mobile Card Layout */}
            <div className="block sm:hidden space-y-4">
              {users.map((user) => (
                <div key={user.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm break-all">{user.email}</div>
                      {user.name && (
                        <div className="text-gray-500 text-sm mt-1">{user.name}</div>
                      )}
                    </div>
                    <div className="ml-2">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? '管理員' : '用戶'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>狀態：</span>
                    {getStatusBadge(user.status)}
                  </div>
                  
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>創建：{new Date(user.createdAt).toLocaleDateString('zh-TW')}</div>
                    <div>
                      最後登入：{user.lastLoginAt 
                        ? new Date(user.lastLoginAt).toLocaleDateString('zh-TW')
                        : '從未登入'
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm font-medium">Email</th>
                    <th className="text-left py-2 text-sm font-medium">姓名</th>
                    <th className="text-left py-2 text-sm font-medium">角色</th>
                    <th className="text-left py-2 text-sm font-medium">狀態</th>
                    <th className="text-left py-2 text-sm font-medium">創建時間</th>
                    <th className="text-left py-2 text-sm font-medium">最後登入</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-3 text-sm break-all">{user.email}</td>
                      <td className="py-3 text-sm">{user.name || '-'}</td>
                      <td className="py-3">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? '管理員' : '用戶'}
                        </Badge>
                      </td>
                      <td className="py-3">{getStatusBadge(user.status)}</td>
                      <td className="py-3 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="py-3 text-sm text-gray-500">
                        {user.lastLoginAt 
                          ? new Date(user.lastLoginAt).toLocaleDateString('zh-TW')
                          : '從未登入'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  用戶管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">載入用戶資料中...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">目前沒有用戶</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((u) => (
                      <div key={u.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                {u.role === 'admin' ? (
                                  <Crown className="w-5 h-5 text-yellow-600" />
                                ) : (
                                  <Users className="w-5 h-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-medium text-gray-900">{u.name || u.email}</h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                  <span>📧 {u.email}</span>
                                  <span>🛡️ {u.role}</span>
                                  <span>📅 {new Date(u.createdAt).toLocaleDateString('zh-TW')}</span>
                                  {u.lastLoginAt && (
                                    <span>🕒 最後登入: {new Date(u.lastLoginAt).toLocaleDateString('zh-TW')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={u.status === 'active' ? 'default' : 'secondary'}
                            >
                              {u.status === 'active' ? '啟用' : '停用'}
                            </Badge>
                            <Badge 
                              variant={u.role === 'admin' ? 'destructive' : 'outline'}
                            >
                              {u.role === 'admin' ? '管理員' : '用戶'}
                            </Badge>
                            
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditingUser(u)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>編輯用戶 - {u.name || u.email}</DialogTitle>
                                  <DialogDescription>
                                    修改用戶權限和狀態設定
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium">用戶角色</label>
                                    <Select 
                                      defaultValue={u.role} 
                                      onValueChange={handleRoleChange}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="user">一般用戶</SelectItem>
                                        <SelectItem value="admin">管理員</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">帳號狀態</label>
                                    <Select 
                                      defaultValue={u.status} 
                                      onValueChange={handleStatusChange}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">啟用</SelectItem>
                                        <SelectItem value="inactive">停用</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setShowDeleteDialog(u)}
                              disabled={u.id === user?.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>

                            <AlertDialog open={showDeleteDialog?.id === u.id} onOpenChange={() => setShowDeleteDialog(null)}>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>確認刪除用戶</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    您確定要刪除用戶 "{u.name || u.email}" 嗎？此操作無法復原。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    刪除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcriptions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileAudio className="w-5 h-5" />
                  轉錄資料管理
                </CardTitle>
                <Button 
                  onClick={fetchTranscriptions}
                  disabled={transcriptionsLoading}
                  className="ml-auto"
                >
                  {transcriptionsLoading ? "載入中..." : "重新載入"}
                </Button>
              </CardHeader>
              <CardContent>
                {transcriptionsLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">載入轉錄資料中...</p>
                  </div>
                ) : transcriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <FileAudio className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">目前沒有轉錄資料</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transcriptions.map((transcription) => (
                      <div key={transcription.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div>
                                <h3 className="font-medium text-gray-900">
                                  {transcription.displayName || transcription.originalName}
                                </h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                  <span>用戶: {transcription.userEmail || '未知用戶'}</span>
                                  <span>狀態: {transcription.status}</span>
                                  {transcription.wordCount && (
                                    <span>字數: {transcription.wordCount}</span>
                                  )}
                                  {transcription.duration && (
                                    <span>時長: {Math.round(transcription.duration / 60)}分鐘</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  建立時間: {new Date(transcription.createdAt).toLocaleString('zh-TW')}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={
                                transcription.status === 'completed' ? 'default' : 
                                transcription.status === 'error' ? 'destructive' : 'secondary'
                              }
                            >
                              {transcription.status}
                            </Badge>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <AdminLogs />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}