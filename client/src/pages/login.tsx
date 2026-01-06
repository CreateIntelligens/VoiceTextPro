import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Lock, Mail, Mic, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import ForgotPasswordDialog from '@/components/forgot-password-dialog';
import FirstTimePasswordChange from '@/components/first-time-password-change';

type AuthMode = 'login' | 'register';

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showFirstTimePasswordChange, setShowFirstTimePasswordChange] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
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

      localStorage.setItem('auth_token', data.token);

      if (data.isFirstLogin) {
        setShowFirstTimePasswordChange(true);
        toast({
          title: "首次登入",
          description: "請設置一個新的安全密碼",
        });
      } else {
        toast({
          title: "登入成功",
          description: `歡迎回來，${data.user.name || data.user.email}`,
        });
        window.location.href = '/';
      }
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證密碼
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "密碼不一致",
        description: "請確認兩次輸入的密碼相同",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "密碼過短",
        description: "密碼必須至少 8 個字元",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '註冊失敗');
      }

      setVerificationSent(true);
      toast({
        title: "註冊成功",
        description: data.message || "請檢查您的信箱以完成驗證",
      });
    } catch (error) {
      toast({
        title: "註冊失敗",
        description: error instanceof Error ? error.message : "註冊過程中發生錯誤",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const data = await response.json();

      toast({
        title: "已發送",
        description: data.message || "如果該信箱需要驗證，驗證郵件已發送",
      });
    } catch (error) {
      toast({
        title: "發送失敗",
        description: "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showFirstTimePasswordChange) {
    return (
      <FirstTimePasswordChange
        onPasswordChanged={() => {
          setShowFirstTimePasswordChange(false);
          window.location.href = '/';
        }}
      />
    );
  }

  // 驗證郵件已發送畫面
  if (verificationSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12">
        <div className="max-w-sm mx-auto w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            驗證郵件已發送
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            我們已將驗證連結發送至 <span className="font-medium text-foreground">{formData.email}</span>，請檢查您的收件匣並點擊連結完成驗證。
          </p>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={handleResendVerification}
              disabled={loading}
            >
              {loading ? '發送中...' : '重新發送驗證郵件'}
            </Button>
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl"
              onClick={() => {
                setVerificationSent(false);
                setMode('login');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
            >
              返回登入
            </Button>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-600 dark:text-amber-400 text-left">
                驗證完成後，您的帳號仍需等待管理員審核才能使用。
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12">
      <div className="max-w-sm mx-auto w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 mb-4">
            <Mic className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            語音轉錄平台
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? '登入您的帳號' : '申請新帳號'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="請輸入您的 Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-10 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-1"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                密碼
              </label>
              {mode === 'login' && <ForgotPasswordDialog />}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'register' ? '請設定密碼（至少 8 個字元）' : '請輸入您的密碼'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-10 pr-10 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-1"
                required
                minLength={mode === 'register' ? 8 : undefined}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (註冊時) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                確認密碼
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="請再次輸入密碼"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="pl-10 pr-10 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-1"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-11 rounded-xl text-sm font-medium mt-2"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                {mode === 'login' ? '登入中...' : '提交中...'}
              </div>
            ) : (
              mode === 'login' ? '登入' : '申請帳號'
            )}
          </Button>
        </form>

        {/* Mode Toggle */}
        <div className="mt-6 text-center">
          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              還沒有帳號？<span className="text-primary font-medium">立即申請</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              已有帳號？<span className="text-primary font-medium">登入</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
