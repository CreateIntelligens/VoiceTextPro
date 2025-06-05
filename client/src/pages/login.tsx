import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, User, FileText } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    reason: ''
  });
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登入失敗');
      }

      // Store token and redirect
      localStorage.setItem('auth_token', data.token);
      toast({
        title: "登入成功",
        description: `歡迎回來，${data.user.name || data.user.email}`,
      });
      
      // Force page reload to trigger auth check
      window.location.href = '/';
    } catch (error) {
      toast({
        title: "登入失敗",
        description: error instanceof Error ? error.message : "請檢查您的登入資訊",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          reason: formData.reason
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '申請失敗');
      }

      toast({
        title: "申請已提交",
        description: "您的帳號申請已提交，管理員將會盡快審核",
      });

      setFormData({ email: '', password: '', name: '', reason: '' });
      setIsLogin(true);
    } catch (error) {
      toast({
        title: "申請失敗",
        description: error instanceof Error ? error.message : "申請過程中發生錯誤",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center px-4 sm:px-6">
          <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">
            <span className="hidden sm:inline">智能語音轉錄平台</span>
            <span className="sm:hidden">轉錄平台</span>
          </CardTitle>
          <p className="text-sm sm:text-base text-gray-600">
            {isLogin ? '登入您的帳號' : '申請新帳號'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={isLogin ? handleLogin : handleApply} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="請輸入您的 Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <Label htmlFor="name">姓名</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="請輸入您的姓名"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {isLogin && (
              <div>
                <Label htmlFor="password">密碼</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="請輸入您的密碼"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div>
                <Label htmlFor="reason">申請理由</Label>
                <textarea
                  id="reason"
                  placeholder="請簡述您申請帳號的原因"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {isLogin ? '登入中...' : '提交中...'}
                </div>
              ) : (
                isLogin ? '登入' : '提交申請'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormData({ email: '', password: '', name: '', reason: '' });
              }}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              {isLogin ? '還沒有帳號？申請新帳號' : '已有帳號？立即登入'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}