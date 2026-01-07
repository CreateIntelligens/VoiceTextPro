import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  RefreshCw,
  FileText,
  Settings,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Clock,
  User,
  Hash,
  Sparkles,
  Database,
  Shield,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface AdminLog {
  id: number;
  category: string;
  action: string;
  description: string;
  details?: any;
  userId?: number;
  transcriptionId?: number;
  severity: string;
  createdAt: Date;
}

type FilterCategory = "all" | "unified_analysis" | "multimodal_analysis" | "ai_cleanup" | "ai_analysis" | "admin" | "transcription" | "system";

export function AdminLogs() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");

  const { data: logs = [], isLoading, refetch } = useQuery<AdminLog[]>({
    queryKey: ["/api/admin/logs"],
    refetchInterval: 30000,
    enabled: isAuthenticated && user?.role === 'admin',
    retry: false,
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/logs", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    },
  });

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "success":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-700",
          badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
          label: "成功"
        };
      case "high":
      case "error":
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          bg: "bg-red-50",
          border: "border-red-200",
          text: "text-red-700",
          badge: "bg-red-100 text-red-800 border-red-300",
          label: severity === "high" ? "嚴重" : "錯誤"
        };
      case "medium":
      case "warning":
        return {
          icon: <AlertTriangle className="h-4 w-4" />,
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-700",
          badge: "bg-amber-100 text-amber-800 border-amber-300",
          label: severity === "medium" ? "中等" : "警告"
        };
      case "low":
        return {
          icon: <Info className="h-4 w-4" />,
          bg: "bg-slate-50",
          border: "border-slate-200",
          text: "text-slate-600",
          badge: "bg-slate-100 text-slate-700 border-slate-300",
          label: "低"
        };
      default:
        return {
          icon: <Info className="h-4 w-4" />,
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          badge: "bg-blue-100 text-blue-800 border-blue-300",
          label: "資訊"
        };
    }
  };

  const getCategoryConfig = (category: string) => {
    switch (category) {
      case "unified_analysis":
        return {
          icon: <Sparkles className="h-4 w-4" />,
          color: "text-violet-600",
          bg: "bg-violet-100",
          label: "統一分析"
        };
      case "multimodal_analysis":
        return {
          icon: <Sparkles className="h-4 w-4" />,
          color: "text-purple-600",
          bg: "bg-purple-100",
          label: "多模態分析"
        };
      case "ai_cleanup":
        return {
          icon: <Sparkles className="h-4 w-4" />,
          color: "text-green-600",
          bg: "bg-green-100",
          label: "AI 整理"
        };
      case "ai_analysis":
        return {
          icon: <Activity className="h-4 w-4" />,
          color: "text-indigo-600",
          bg: "bg-indigo-100",
          label: "AI 分析"
        };
      case "transcription":
        return {
          icon: <FileText className="h-4 w-4" />,
          color: "text-blue-600",
          bg: "bg-blue-100",
          label: "轉錄"
        };
      case "admin":
        return {
          icon: <Shield className="h-4 w-4" />,
          color: "text-orange-600",
          bg: "bg-orange-100",
          label: "管理"
        };
      case "system":
        return {
          icon: <Database className="h-4 w-4" />,
          color: "text-slate-600",
          bg: "bg-slate-100",
          label: "系統"
        };
      default:
        return {
          icon: <Settings className="h-4 w-4" />,
          color: "text-gray-600",
          bg: "bg-gray-100",
          label: category
        };
    }
  };

  const filterCategories: { value: FilterCategory; label: string }[] = [
    { value: "all", label: "全部" },
    { value: "unified_analysis", label: "統一分析" },
    { value: "multimodal_analysis", label: "多模態分析" },
    { value: "ai_cleanup", label: "AI 整理" },
    { value: "ai_analysis", label: "AI 分析" },
    { value: "admin", label: "管理操作" },
    { value: "transcription", label: "轉錄" },
    { value: "system", label: "系統" },
  ];

  // 過濾日誌
  const filteredLogs = (logs as AdminLog[]).filter(log => {
    const matchesSearch = searchTerm === "" ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || log.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // 統計
  const stats = {
    total: logs.length,
    errors: logs.filter(l => l.severity === "high" || l.severity === "error").length,
    warnings: logs.filter(l => l.severity === "medium" || l.severity === "warning").length,
    success: logs.filter(l => l.severity === "success").length,
  };

  return (
    <Card className="w-full border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
      <CardHeader className="border-b bg-white/80 backdrop-blur-sm pb-4">
        <div className="flex flex-col gap-4">
          {/* 標題列 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  系統日誌監控
                </CardTitle>
                <p className="text-sm text-slate-500 mt-0.5">
                  追蹤系統活動與錯誤記錄
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearLogsMutation.mutate()}
                disabled={clearLogsMutation.isPending}
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                清空
              </Button>
            </div>
          </div>

          {/* 統計卡片 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="px-4 py-3 rounded-lg bg-slate-100 border border-slate-200">
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
              <div className="text-xs text-slate-500">總記錄</div>
            </div>
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200">
              <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
              <div className="text-xs text-red-500">錯誤</div>
            </div>
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-2xl font-bold text-amber-600">{stats.warnings}</div>
              <div className="text-xs text-amber-500">警告</div>
            </div>
            <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">{stats.success}</div>
              <div className="text-xs text-emerald-500">成功</div>
            </div>
          </div>

          {/* 搜尋與篩選 */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜尋日誌..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {filterCategories.map(cat => (
                <Button
                  key={cat.value}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterCategory(cat.value)}
                  className={`text-xs px-3 h-8 ${
                    filterCategory === cat.value
                      ? "bg-white shadow-sm text-slate-800"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-indigo-500" />
                <p className="text-slate-500">載入日誌中...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">暫無日誌記錄</p>
                <p className="text-sm text-slate-400 mt-1">系統活動將會記錄在這裡</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLogs.map((log: AdminLog, index: number) => {
                const logId = `${log.id}-${index}`;
                const isExpanded = expandedLogs.has(logId);
                const severity = getSeverityConfig(log.severity);
                const category = getCategoryConfig(log.category);

                return (
                  <div
                    key={logId}
                    className={`px-4 py-3 hover:bg-slate-50/80 transition-colors ${severity.bg}`}
                  >
                    {/* 主要內容 */}
                    <div className="flex items-start gap-3">
                      {/* 類別圖示 */}
                      <div className={`p-2 rounded-lg ${category.bg} ${category.color} mt-0.5`}>
                        {category.icon}
                      </div>

                      {/* 內容區 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* 類別標籤 */}
                          <Badge variant="outline" className={`text-xs ${category.bg} ${category.color} border-0`}>
                            {category.label}
                          </Badge>
                          {/* 嚴重度標籤 */}
                          <Badge variant="outline" className={`text-xs gap-1 ${severity.badge}`}>
                            {severity.icon}
                            {severity.label}
                          </Badge>
                          {/* Action */}
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </div>

                        {/* 描述 */}
                        <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">
                          {log.description}
                        </p>

                        {/* 底部資訊 */}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.createdAt), "yyyy/MM/dd HH:mm:ss", { locale: zhTW })}
                          </span>
                          {log.userId && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              用戶 #{log.userId}
                            </span>
                          )}
                          {log.transcriptionId && (
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              轉錄 #{log.transcriptionId}
                            </span>
                          )}
                        </div>

                        {/* 詳細資訊展開 */}
                        {log.details && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleExpand(logId)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              {isExpanded ? "收起詳情" : "查看詳情"}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono overflow-x-auto">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
