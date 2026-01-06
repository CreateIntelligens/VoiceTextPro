import { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Clock,
  DollarSign,
  FileText,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Cpu
} from 'lucide-react';

interface UsageStats {
  speechToText: {
    totalTranscriptions: number;
    totalAudioMinutes: number;
    totalAudioSeconds: number;
    monthlyAudioMinutes: number;
    monthlyAudioSeconds: number;
    costEstimate: number;
    monthlyCostEstimate: number;
  };
  gemini: {
    totalRequests: number;
    totalTokens: number;
    monthlyTokens: number;
    remainingTokens: number;
    costEstimate: number;
  };
  system: {
    totalTranscriptions: number;
    totalAudioMinutes: number;
    totalStorageUsed: number;
    activeTranscriptions: number;
    completedTranscriptions: number;
    errorTranscriptions: number;
  };
}

interface TrendData {
  date: string;
  transcriptions: number;
  minutes: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [statsResponse, trendResponse] = await Promise.all([
        fetch('/api/usage/stats', { headers }),
        fetch('/api/usage/trend', { headers })
      ]);

      if (!statsResponse.ok || !trendResponse.ok) {
        throw new Error('無法獲取使用統計數據');
      }

      const statsData = await statsResponse.json();
      const trendDataResult = await trendResponse.json();

      setStats(statsData);
      setTrendData(trendDataResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '獲取數據時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number | null | undefined) => {
    const numBytes = Number(bytes);
    if (!numBytes || numBytes === 0 || isNaN(numBytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return '0 B';
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-TW').format(num);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">載入失敗</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const speechFreeMinutes = 60;
  const speechUsagePercent = Math.min(100, (stats.speechToText.monthlyAudioMinutes / speechFreeMinutes) * 100);
  const geminiUsagePercent = Math.min(100, (stats.gemini.monthlyTokens / 1500000) * 100);

  const total = stats.system.completedTranscriptions + stats.system.activeTranscriptions + stats.system.errorTranscriptions;
  const completedPercent = total > 0 ? (stats.system.completedTranscriptions / total) * 100 : 0;
  const activePercent = total > 0 ? (stats.system.activeTranscriptions / total) * 100 : 0;
  const errorPercent = total > 0 ? (stats.system.errorTranscriptions / total) * 100 : 0;

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-xs text-muted-foreground mb-1">
            {new Date(label).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
          </p>
          <p className="text-sm text-primary font-medium">
            {payload[0].value} 筆轉錄
          </p>
          {payload[1] && (
            <p className="text-sm text-emerald-500 font-medium">
              {payload[1].value} 分鐘
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-foreground">統計</h1>
          <p className="text-sm text-muted-foreground mt-1">API 使用量和系統狀態</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 space-y-4">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <FileText className="w-5 h-5 text-primary mb-3" />
            <div className="text-2xl font-bold text-foreground">{formatNumber(stats.system.totalTranscriptions)}</div>
            <p className="text-xs text-muted-foreground mt-1">總轉錄數</p>
          </div>

          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <Clock className="w-5 h-5 text-emerald-500 mb-3" />
            <div className="text-2xl font-bold text-foreground">{formatNumber(stats.system.totalAudioMinutes)}</div>
            <p className="text-xs text-muted-foreground mt-1">總時長（分鐘）</p>
          </div>

          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <DollarSign className="w-5 h-5 text-amber-500 mb-3" />
            <div className="text-2xl font-bold text-foreground">
              ${(stats.speechToText.costEstimate + stats.gemini.costEstimate).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">總成本（USD）</p>
          </div>

          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <Activity className="w-5 h-5 text-secondary mb-3" />
            <div className="text-2xl font-bold text-foreground">{formatBytes(stats.system.totalStorageUsed)}</div>
            <p className="text-xs text-muted-foreground mt-1">儲存空間</p>
          </div>
        </div>

        {/* Trend Chart */}
        <div className="p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground">30天使用趨勢</h3>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">轉錄數</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">音檔分鐘</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTranscriptions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0abdc6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#0abdc6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="transcriptions"
                stroke="#0abdc6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTranscriptions)"
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="#22c55e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMinutes)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* API Usage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Speech-to-Text */}
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Speech-to-Text</span>
                <p className="text-[10px] text-muted-foreground">Google Cloud · Chirp 3</p>
              </div>
            </div>

            {/* Usage Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">本月使用量</span>
                <span className="text-xs font-medium text-foreground">
                  {stats.speechToText.monthlyAudioMinutes} / 60 分鐘
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    speechUsagePercent > 80 ? 'bg-destructive' : speechUsagePercent > 50 ? 'bg-amber-500' : 'bg-primary'
                  }`}
                  style={{ width: `${speechUsagePercent}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground">總時長</p>
                <p className="font-semibold text-foreground">{formatNumber(stats.speechToText.totalAudioMinutes)} 分</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground">本月成本</p>
                <p className="font-semibold text-primary">${stats.speechToText.monthlyCostEstimate.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Gemini AI */}
          <div className="p-4 rounded-xl bg-card/50 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Gemini AI</span>
                <p className="text-[10px] text-muted-foreground">Vertex AI · 2.0 Flash</p>
              </div>
            </div>

            {/* Usage Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground">本月 Token</span>
                <span className="text-xs font-medium text-foreground">
                  {formatNumber(stats.gemini.monthlyTokens)} / 1.5M
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    geminiUsagePercent > 80 ? 'bg-destructive' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${geminiUsagePercent}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground">總請求</p>
                <p className="font-semibold text-foreground">{formatNumber(stats.gemini.totalRequests)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground">估算成本</p>
                <p className="font-semibold text-emerald-500">${stats.gemini.costEstimate.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="p-4 rounded-xl bg-card/50 border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">系統狀態</h3>
          </div>

          {/* Horizontal Bar */}
          <div className="h-4 rounded-full overflow-hidden flex mb-4">
            {completedPercent > 0 && (
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${completedPercent}%` }}
              />
            )}
            {activePercent > 0 && (
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${activePercent}%` }}
              />
            )}
            {errorPercent > 0 && (
              <div
                className="bg-destructive h-full transition-all"
                style={{ width: `${errorPercent}%` }}
              />
            )}
            {total === 0 && (
              <div className="bg-muted h-full w-full" />
            )}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stats.system.completedTranscriptions}</p>
                <p className="text-[10px] text-muted-foreground">已完成</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stats.system.activeTranscriptions}</p>
                <p className="text-[10px] text-muted-foreground">處理中</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stats.system.errorTranscriptions}</p>
                <p className="text-[10px] text-muted-foreground">錯誤</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
