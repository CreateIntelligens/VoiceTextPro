import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MessageSquare, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Send,
  User,
  Bot,
  Calendar,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChatSession, ChatMessage } from "@shared/schema";

interface ExtendedChatSession extends ChatSession {
  userName?: string;
  userEmail?: string;
}

export default function AdminChat() {
  const [selectedSession, setSelectedSession] = useState<ExtendedChatSession | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all chat sessions for admin
  const { data: sessions = [], isLoading } = useQuery<ExtendedChatSession[]>({
    queryKey: ["/api/admin/chat/sessions"],
  });

  // Fetch messages for selected session
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", selectedSession?.id],
    enabled: !!selectedSession?.id,
  });

  // Send admin reply
  const replyMutation = useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: number; message: string }) => {
      const response = await apiRequest(`/api/admin/chat/sessions/${sessionId}/reply`, "POST", { message });
      return response.json();
    },
    onSuccess: () => {
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", selectedSession?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/sessions"] });
      toast({
        title: "回覆已發送",
        description: "您的回覆已成功發送給用戶",
      });
    },
    onError: (error) => {
      toast({
        title: "發送失敗",
        description: error instanceof Error ? error.message : "發送回覆失敗",
        variant: "destructive",
      });
    },
  });

  // Update session status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: number; status: string }) => {
      const response = await apiRequest(`/api/admin/chat/sessions/${sessionId}/status`, "PATCH", { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/sessions"] });
      toast({
        title: "狀態已更新",
        description: "對話狀態已成功更新",
      });
    },
    onError: (error) => {
      toast({
        title: "更新失敗",
        description: error instanceof Error ? error.message : "更新狀態失敗",
        variant: "destructive",
      });
    },
  });

  const handleSendReply = () => {
    if (!selectedSession || !replyMessage.trim()) return;
    replyMutation.mutate({
      sessionId: selectedSession.id,
      message: replyMessage.trim(),
    });
  };

  const handleStatusUpdate = (status: string) => {
    if (!selectedSession) return;
    updateStatusMutation.mutate({
      sessionId: selectedSession.id,
      status,
    });
  };

  const formatTime = (dateString: string | Date | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'active':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved':
        return "bg-green-100 text-green-800";
      case 'active':
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-orange-100 text-orange-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      general: "一般問題",
      bug: "錯誤回報",
      feature: "功能建議",
      question: "使用問題"
    };
    return labels[category as keyof typeof labels] || category;
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    if (statusFilter !== "all" && session.status !== statusFilter) return false;
    if (priorityFilter !== "all" && session.priority !== priorityFilter) return false;
    return true;
  });

  // Statistics
  const stats = {
    total: sessions.length,
    active: sessions.filter(s => s.status === 'active').length,
    resolved: sessions.filter(s => s.status === 'resolved').length,
    urgent: sessions.filter(s => s.priority === 'urgent').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">客服對話管理</h1>
        <p className="text-slate-600">管理用戶反饋和客服對話</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-600">總對話數</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-slate-600">待處理</p>
                <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-slate-600">已解決</p>
                <p className="text-2xl font-bold text-slate-900">{stats.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-slate-600">緊急</p>
                <p className="text-2xl font-bold text-slate-900">{stats.urgent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>對話列表</span>
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                </div>
              </CardTitle>
              <div className="flex space-x-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="狀態篩選" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有狀態</SelectItem>
                    <SelectItem value="active">待處理</SelectItem>
                    <SelectItem value="resolved">已解決</SelectItem>
                    <SelectItem value="archived">已歸檔</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="優先級篩選" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">所有優先級</SelectItem>
                    <SelectItem value="urgent">緊急</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 p-4">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`p-3 border rounded cursor-pointer transition-colors hover:bg-slate-50 ${
                        selectedSession?.id === session.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm truncate">
                          {session.title || `對話 ${session.sessionId}`}
                        </span>
                        {getStatusIcon(session.status)}
                      </div>
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={`text-xs ${getStatusColor(session.status)}`}>
                          {session.status === 'active' ? '待處理' : 
                           session.status === 'resolved' ? '已解決' : '已歸檔'}
                        </Badge>
                        <Badge className={`text-xs ${getPriorityColor(session.priority)}`}>
                          {session.priority}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        <div className="flex items-center space-x-1 mb-1">
                          <Users className="w-3 h-3" />
                          <span>{session.userName || session.userEmail}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatTime(session.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-2">
          {selectedSession ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {selectedSession.title || `對話 ${selectedSession.sessionId}`}
                    </CardTitle>
                    <p className="text-sm text-slate-600">
                      用戶：{selectedSession.userName || selectedSession.userEmail} | 
                      類型：{getCategoryLabel(selectedSession.category)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedSession.status}
                      onValueChange={handleStatusUpdate}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">待處理</SelectItem>
                        <SelectItem value="resolved">已解決</SelectItem>
                        <SelectItem value="archived">已歸檔</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Messages */}
                <ScrollArea className="h-[400px] mb-4 border rounded p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.messageType === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          message.messageType === 'user' 
                            ? 'bg-slate-100 text-slate-900' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          <div className="flex items-center space-x-2 mb-1">
                            {message.messageType === 'user' ? (
                              <User className="w-4 h-4" />
                            ) : (
                              <Bot className="w-4 h-4" />
                            )}
                            <span className="text-xs opacity-75">
                              {formatTime(message.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Reply Interface */}
                <div className="space-y-3">
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="輸入回覆訊息..."
                    className="min-h-[100px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim() || replyMutation.isPending}
                      className="flex items-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>發送回覆</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">選擇對話</h3>
                  <p className="text-slate-500">
                    從左側列表選擇一個對話開始管理
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}