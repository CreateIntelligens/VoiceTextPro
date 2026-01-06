import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mic, Clock } from 'lucide-react';

type VerificationState = 'loading' | 'success' | 'success-pending' | 'error';

export default function VerifyEmail() {
  const [, params] = useRoute('/verify-email/:token');
  const [, setLocation] = useLocation();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!params?.token) {
        setState('error');
        setMessage('驗證連結無效');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-email/${params.token}`);
        const data = await response.json();

        if (!response.ok) {
          setState('error');
          setMessage(data.message || '驗證失敗');
          return;
        }

        setEmail(data.email || '');

        // 判斷是否需要管理員審核
        if (data.needsAdminApproval) {
          setState('success-pending');
          setMessage('Email 驗證成功！您的帳號正在等待管理員審核。');
        } else {
          setState('success');
          setMessage('Email 驗證成功！您現在可以登入系統。');
        }
      } catch (error) {
        setState('error');
        setMessage('驗證過程中發生錯誤，請稍後再試');
      }
    };

    verifyEmail();
  }, [params?.token]);

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12">
      <div className="max-w-sm mx-auto w-full text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 mb-6">
          <Mic className="w-7 h-7 text-primary" />
        </div>

        {/* Loading State */}
        {state === 'loading' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              驗證中...
            </h1>
            <p className="text-sm text-muted-foreground">
              請稍候，我們正在驗證您的 Email
            </p>
          </>
        )}

        {/* Success State */}
        {state === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              驗證成功
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {message}
            </p>
            {email && (
              <p className="text-sm text-muted-foreground mb-6">
                帳號: <span className="font-medium text-foreground">{email}</span>
              </p>
            )}
            <Button
              className="w-full h-11 rounded-xl"
              onClick={() => setLocation('/login')}
            >
              前往登入
            </Button>
          </>
        )}

        {/* Success with Pending Approval State */}
        {state === 'success-pending' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 mb-4">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              Email 驗證成功
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              {message}
            </p>
            {email && (
              <p className="text-sm text-muted-foreground mb-6">
                帳號: <span className="font-medium text-foreground">{email}</span>
              </p>
            )}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-6">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                您的帳號申請已提交，管理員將會盡快審核。審核通過後，您將收到通知郵件。
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={() => setLocation('/login')}
            >
              返回首頁
            </Button>
          </>
        )}

        {/* Error State */}
        {state === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              驗證失敗
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
                如果連結已過期，您可以在登入頁面重新發送驗證郵件
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
