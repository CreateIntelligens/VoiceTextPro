import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, Mic, Lock, Eye, EyeOff } from 'lucide-react';

type ResetState = 'loading' | 'valid' | 'success' | 'error';

export default function ResetPassword() {
  const [, params] = useRoute('/reset-password/:token');
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ResetState>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const verifyToken = async () => {
      if (!params?.token) {
        setState('error');
        setMessage('重設連結無效');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-reset-token/${params.token}`);
        const data = await response.json();

        if (!response.ok || !data.valid) {
          setState('error');
          setMessage(data.message || '重設連結無效或已過期');
          return;
        }

        setEmail(data.email || '');
        setState('valid');
      } catch (error) {
        setState('error');
        setMessage('驗證過程中發生錯誤，請稍後再試');
      }
    };

    verifyToken();
  }, [params?.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "密碼不一致",
        description: "請確認兩次輸入的密碼相同",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "密碼過短",
        description: "密碼必須至少 8 個字元",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: params?.token,
          newPassword: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '密碼重設失敗');
      }

      setState('success');
      setMessage('密碼已成功重設！');
      toast({
        title: "密碼已重設",
        description: "請使用新密碼登入",
      });
    } catch (error) {
      toast({
        title: "重設失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12">
      <div className="max-w-sm mx-auto w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 mb-4">
            <Mic className="w-7 h-7 text-primary" />
          </div>
        </div>

        {/* Loading State */}
        {state === 'loading' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              驗證中...
            </h1>
            <p className="text-sm text-muted-foreground">
              請稍候，我們正在驗證您的重設連結
            </p>
          </div>
        )}

        {/* Valid Token - Show Reset Form */}
        {state === 'valid' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-xl font-semibold text-foreground">
                重設密碼
              </h1>
              {email && (
                <p className="text-sm text-muted-foreground mt-1">
                  帳號: <span className="font-medium text-foreground">{email}</span>
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                  新密碼
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="請輸入新密碼（至少 8 個字元）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl bg-card/50 border-border/50 focus-visible:ring-1"
                    required
                    minLength={8}
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

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                  確認新密碼
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="請再次輸入新密碼"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-sm font-medium"
                disabled={submitting}
              >
                {submitting ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin mr-2" />
                    處理中...
                  </div>
                ) : (
                  '重設密碼'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLocation('/login')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                返回登入
              </button>
            </div>
          </>
        )}

        {/* Success State */}
        {state === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              密碼已重設
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {message}
            </p>
            <Button
              className="w-full h-11 rounded-xl"
              onClick={() => setLocation('/login')}
            >
              前往登入
            </Button>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              連結無效
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {message}
            </p>
            <div className="space-y-3">
              <Button
                className="w-full h-11 rounded-xl"
                onClick={() => setLocation('/login')}
              >
                返回登入
              </Button>
              <p className="text-xs text-muted-foreground">
                您可以在登入頁面重新發送密碼重設郵件
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
