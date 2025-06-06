import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, RefreshCw, Bug, Settings, CheckCircle, AlertTriangle, Info } from "lucide-react";
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

export function AdminLogs() {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/logs"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/logs", "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "success":
        return "bg-green-100 text-green-800 border-green-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "transcription":
        return <Bug className="h-4 w-4" />;
      case "ui_fix":
      case "color_fix":
        return <Settings className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              管理員日誌系統
            </CardTitle>
            <CardDescription>
              系統變動追蹤與調試信息記錄
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              重新整理
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => clearLogsMutation.mutate()}
              disabled={clearLogsMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              清空日誌
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">載入日誌中...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Bug className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-500">暫無日誌記錄</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log: AdminLog) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(log.category)}
                      <Badge variant="outline" className="text-xs">
                        {log.category}
                      </Badge>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getSeverityColor(log.severity)}`}
                      >
                        {getSeverityIcon(log.severity)}
                        {log.severity}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(log.createdAt), "MM/dd HH:mm:ss", { locale: zhTW })}
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <h4 className="font-medium text-sm text-gray-900 mb-1">
                      {log.action}
                    </h4>
                    <p className="text-sm text-gray-700">
                      {log.description}
                    </p>
                  </div>

                  {log.details && (
                    <div className="mt-3 p-3 bg-white rounded border">
                      <h5 className="text-xs font-medium text-gray-600 mb-2">詳細信息：</h5>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  {(log.userId || log.transcriptionId) && (
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {log.userId && (
                        <span>用戶ID: {log.userId}</span>
                      )}
                      {log.transcriptionId && (
                        <span>轉錄ID: {log.transcriptionId}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}