import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { usePushNotification } from "@/hooks/use-push-notification";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Shield,
  LogOut,
  ChevronRight,
  HelpCircle,
  Info,
  Bell,
  BellOff,
  Loader2,
  Gauge,
  Clock,
  FileAudio,
  Database,
  Calendar,
  Link,
  Unlink,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface UsageStats {
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

interface GoogleCalendarStatus {
  configured: boolean;
  linked: boolean;
  email?: string;
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();

  // Handle Google OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const googleSuccess = params.get('google_success');
    const googleError = params.get('google_error');
    const email = params.get('email');

    if (googleSuccess === 'true') {
      toast({
        title: "Google Calendar \u5df2\u7d81\u5b9a",
        description: email ? `\u5df2\u6210\u529f\u7d81\u5b9a ${email}` : "\u5df2\u6210\u529f\u7d81\u5b9a Google Calendar",
      });
      // Clean URL
      window.history.replaceState({}, '', '/#/account');
      // Refresh status
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/status'] });
    } else if (googleError) {
      const errorMessages: Record<string, string> = {
        'access_denied': '\u7528\u6236\u53d6\u6d88\u4e86\u6388\u6b0a',
        'invalid_params': '\u7121\u6548\u7684\u8acb\u6c42\u53c3\u6578',
        'invalid_state': '\u6388\u6b0a\u72c0\u614b\u7121\u6548\u6216\u5df2\u904e\u671f',
        'callback_failed': '\u6388\u6b0a\u56de\u8abf\u5931\u6557',
      };
      toast({
        title: "\u7d81\u5b9a\u5931\u6557",
        description: errorMessages[googleError] || googleError,
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, '', '/#/account');
    }
  }, [searchString, toast, queryClient]);

  // Fetch Google Calendar status
  const { data: calendarStatus, isLoading: isCalendarLoading } = useQuery<GoogleCalendarStatus>({
    queryKey: ['/api/google/calendar/status'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/google/calendar/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
  });

  // Link Google Calendar
  const linkGoogleMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/google/auth/url', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get auth URL');
      }
      const data = await response.json();
      return data.url;
    },
    onSuccess: (url) => {
      // Redirect to Google OAuth
      window.location.href = url;
    },
    onError: (error: Error) => {
      toast({
        title: "\u7d81\u5b9a\u5931\u6557",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unlink Google Calendar
  const unlinkGoogleMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/google/auth/unlink', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to unlink');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "\u5df2\u89e3\u9664\u7d81\u5b9a",
        description: "Google Calendar \u5df2\u89e3\u9664\u7d81\u5b9a",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/status'] });
    },
    onError: (error: Error) => {
      toast({
        title: "\u89e3\u9664\u7d81\u5b9a\u5931\u6557",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/user/usage', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUsage(data);
        }
      } catch (error) {
        console.error('Failed to fetch usage:', error);
      } finally {
        setLoadingUsage(false);
      }
    };
    fetchUsage();
  }, []);
  const [, setLocation] = useLocation();
  const {
    isSupported,
    isSubscribed,
    isLoading: isPushLoading,
    permission,
    subscribe,
    unsubscribe,
  } = usePushNotification();

  const handleLogout = () => {
    logout();
    setLocation('/');
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const menuItems = [
    ...(user?.role === 'admin' ? [
      {
        icon: Shield,
        label: '管理員面板',
        description: '用戶管理和系統設定',
        onClick: () => setLocation('/admin'),
        showBadge: true,
      },
    ] : []),
    {
      icon: HelpCircle,
      label: '使用說明',
      description: '了解如何使用轉錄功能',
      onClick: () => {},
    },
    {
      icon: Info,
      label: '關於',
      description: '版本資訊和更新日誌',
      onClick: () => {},
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pt-6 pb-4 px-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-semibold text-foreground">帳戶</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-24">
        {/* Profile Section */}
        <div className="flex items-center space-x-4 py-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
            <span className="text-primary text-2xl font-semibold">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold text-foreground">
                {user?.name || user?.email?.split('@')[0]}
              </h2>
              {user?.role === 'admin' && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                  管理員
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Usage Stats Section */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">使用量統計</h3>
          </div>
          {loadingUsage ? (
            <div className="p-4 rounded-xl bg-card/50 border border-border/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : usage ? (
            <div className="grid grid-cols-2 gap-3">
              {/* Daily Transcription */}
              <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center space-x-2 mb-2">
                  <FileAudio className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground">今日轉錄</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {usage.daily.transcriptionCount} <span className="text-xs text-muted-foreground font-normal">/ {usage.daily.limit} 次</span>
                </p>
                <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      usage.daily.percentage >= 90 ? 'bg-destructive' :
                      usage.daily.percentage >= 70 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, usage.daily.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Weekly Audio */}
              <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  <span className="text-[10px] text-muted-foreground">本週音頻</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {usage.weekly.audioMinutes} <span className="text-xs text-muted-foreground font-normal">/ {usage.weekly.limits.audioMinutes} 分</span>
                </p>
                <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      usage.weekly.percentage.audioMinutes >= 90 ? 'bg-destructive' :
                      usage.weekly.percentage.audioMinutes >= 70 ? 'bg-amber-500' : 'bg-secondary'
                    }`}
                    style={{ width: `${Math.min(100, usage.weekly.percentage.audioMinutes)}%` }}
                  />
                </div>
              </div>

              {/* Monthly Audio */}
              <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">本月音頻</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {usage.monthly.audioMinutes} <span className="text-xs text-muted-foreground font-normal">/ {usage.monthly.limit} 分</span>
                </p>
                <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      usage.monthly.percentage >= 90 ? 'bg-destructive' :
                      usage.monthly.percentage >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, usage.monthly.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Storage */}
              <div className="p-3 rounded-xl bg-card/50 border border-border/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Database className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground">儲存空間</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {usage.storage.usedMb} <span className="text-xs text-muted-foreground font-normal">/ {usage.storage.limitMb} MB</span>
                </p>
                <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      usage.storage.percentage >= 90 ? 'bg-destructive' :
                      usage.storage.percentage >= 70 ? 'bg-amber-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, usage.storage.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-card/50 border border-border/50 text-center">
              <p className="text-sm text-muted-foreground">無法載入使用量數據</p>
            </div>
          )}
        </div>

        {/* Push Notification Section */}
        {isSupported && (
          <div className="mb-6 p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isSubscribed ? 'bg-emerald-500/10' : 'bg-muted/50'
                }`}>
                  {isSubscribed ? (
                    <Bell className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <BellOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">推送通知</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isSubscribed
                      ? '轉錄完成時收到通知'
                      : permission === 'denied'
                      ? '通知權限已被封鎖'
                      : '開啟以接收轉錄完成通知'}
                  </p>
                </div>
              </div>
              <Button
                variant={isSubscribed ? 'outline' : 'default'}
                size="sm"
                onClick={handlePushToggle}
                disabled={isPushLoading || permission === 'denied'}
                className="h-9 rounded-lg"
              >
                {isPushLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSubscribed ? (
                  '關閉'
                ) : (
                  '開啟'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Google Calendar Section */}
        <div className="mb-6 p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                calendarStatus?.linked ? 'bg-blue-500/10' : 'bg-muted/50'
              }`}>
                <Calendar className={`w-5 h-5 ${
                  calendarStatus?.linked ? 'text-blue-500' : 'text-muted-foreground'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Google Calendar</p>
                {calendarStatus?.linked ? (
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground truncate">
                      {calendarStatus.email}
                    </p>
                  </div>
                ) : calendarStatus?.configured === false ? (
                  <p className="text-xs text-amber-500 mt-0.5">
                    服務尚未設定，請聯繫管理員
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    綁定後可在上傳時選擇會議名稱
                  </p>
                )}
              </div>
            </div>
            {isCalendarLoading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : calendarStatus?.linked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => unlinkGoogleMutation.mutate()}
                disabled={unlinkGoogleMutation.isPending}
                className="h-9 rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {unlinkGoogleMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5 mr-1.5" />
                    解除
                  </>
                )}
              </Button>
            ) : calendarStatus?.configured ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => linkGoogleMutation.mutate()}
                disabled={linkGoogleMutation.isPending}
                className="h-9 rounded-lg"
              >
                {linkGoogleMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Link className="w-3.5 h-3.5 mr-1.5" />
                    綁定
                  </>
                )}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg bg-muted/50">
                未啟用
              </span>
            )}
          </div>
        </div>

        {/* Menu Section */}
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-card/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="text-left">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {item.label}
                    </span>
                    {item.showBadge && (
                      <span className="px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="my-6 h-px bg-border/50" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 p-4 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">登出</span>
        </button>

        {/* Version Info */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground/50">VoiceTextPro v1.0</p>
          <p className="text-[10px] text-muted-foreground/30 mt-1">智能語音轉錄平台</p>
        </div>
      </main>
    </div>
  );
}
