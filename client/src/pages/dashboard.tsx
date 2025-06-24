import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
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
  XCircle
} from 'lucide-react';

interface UsageStats {
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
      
      const [statsResponse, trendResponse] = await Promise.all([
        fetch('/api/usage/stats'),
        fetch('/api/usage/trend')
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-TW').format(num);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">載入儀表板數據中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">載入失敗</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                重新載入
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const geminiUsagePercent = Math.min(100, (stats.gemini.monthlyTokens / 1000000) * 100);

  const systemStatusData = [
    { name: '已完成', value: stats.system.completedTranscriptions, color: '#10B981' },
    { name: '處理中', value: stats.system.activeTranscriptions, color: '#F59E0B' },
    { name: '錯誤', value: stats.system.errorTranscriptions, color: '#EF4444' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">使用狀況儀表板</h1>
          <p className="text-sm sm:text-base text-gray-600">監控 API 使用量、成本和系統狀態</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Transcriptions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">總轉錄數</CardTitle>
              <FileText className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.system.totalTranscriptions)}</div>
              <p className="text-xs text-gray-500">累計處理檔案</p>
            </CardContent>
          </Card>

          {/* Total Audio Minutes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">總音檔時長</CardTitle>
              <Clock className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.system.totalAudioMinutes)}</div>
              <p className="text-xs text-gray-500">分鐘</p>
            </CardContent>
          </Card>

          {/* Total Cost */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">總成本估算</CardTitle>
              <DollarSign className="w-4 h-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats.gemini.costEstimate.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500">USD</p>
            </CardContent>
          </Card>

          {/* Storage Used */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">儲存空間</CardTitle>
              <Activity className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(stats.system.totalStorageUsed)}</div>
              <p className="text-xs text-gray-500">已使用</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Usage Section */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Gemini AI Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                Gemini AI 使用狀況
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">本月 Token 使用量</span>
                  <Badge variant={geminiUsagePercent > 80 ? "destructive" : "secondary"}>
                    {geminiUsagePercent.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={geminiUsagePercent} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatNumber(stats.gemini.monthlyTokens)} tokens</span>
                  <span>限額: 1,000,000 tokens/月</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">總請求數</p>
                  <p className="font-semibold">{formatNumber(stats.gemini.totalRequests)}</p>
                </div>
                <div>
                  <p className="text-gray-600">剩餘 Tokens</p>
                  <p className="font-semibold">{formatNumber(stats.gemini.remainingTokens)}</p>
                </div>
                <div>
                  <p className="text-gray-600">本月成本</p>
                  <p className="font-semibold">${stats.gemini.costEstimate.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Usage Trend */}
          <Card className="lg:col-span-2">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-lg sm:text-xl">30天使用趨勢</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('zh-TW')}
                    formatter={(value, name) => [value, name === 'transcriptions' ? '轉錄數' : '音檔分鐘']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="transcriptions" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="transcriptions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="minutes" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    name="minutes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle>系統狀態</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    <span className="text-sm">已完成</span>
                  </div>
                  <span className="font-semibold">{stats.system.completedTranscriptions}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-yellow-500 mr-2" />
                    <span className="text-sm">處理中</span>
                  </div>
                  <span className="font-semibold">{stats.system.activeTranscriptions}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <XCircle className="w-4 h-4 text-red-500 mr-2" />
                    <span className="text-sm">錯誤</span>
                  </div>
                  <span className="font-semibold">{stats.system.errorTranscriptions}</span>
                </div>
              </div>

              <div className="mt-6">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={systemStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {systemStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}