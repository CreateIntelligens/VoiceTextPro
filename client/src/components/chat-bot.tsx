import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MessageCircle, 
  X, 
  Send, 
  Minimize2, 
  Maximize2,
  Bot,
  User,
  Paperclip,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/hooks/use-auth";
import type { ChatSession, ChatMessage } from "@shared/schema";

interface ChatBotProps {
  className?: string;
}

export default function ChatBot({ className = "" }: ChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [newSessionData, setNewSessionData] = useState({
    title: "",
    category: "general",
    priority: "medium"
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Fetch chat sessions for current user
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["/api/chat/sessions"],
    enabled: isAuthenticated && isOpen,
  });

  // Fetch messages for current session
  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", currentSession?.id],
    enabled: !!currentSession?.id,
    refetchInterval: 1000, // Refresh every second for real-time updates
  });

  // Create new chat session
  const createSessionMutation = useMutation({
    mutationFn: async (data: typeof newSessionData) => {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const response = await apiRequest("/api/chat/sessions", "POST", {
        ...data,
        sessionId,
      });
      return response.json();
    },
    onSuccess: (session) => {
      setCurrentSession(session);
      setNewSessionData({ title: "", category: "general", priority: "medium" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      toast({
        title: "對話已建立",
        description: "您可以開始描述您遇到的問題了",
      });
    },
    onError: (error) => {
      toast({
        title: "建立對話失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // Send message
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("/api/chat/messages", "POST", {
        sessionId: currentSession!.id,
        message,
        messageType: "user",
      });
      return response.json();
    },
    onSuccess: () => {
      setCurrentMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", currentSession?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
    },
    onError: (error) => {
      toast({
        title: "發送失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !currentSession) return;
    sendMessageMutation.mutate(currentMessage);
  };

  const handleCreateSession = () => {
    if (!newSessionData.title.trim()) {
      toast({
        title: "請輸入問題標題",
        description: "標題幫助我們更好地理解您的問題",
        variant: "destructive",
      });
      return;
    }
    createSessionMutation.mutate(newSessionData);
  };

  const formatTime = (dateString: string | Date | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-TW', {
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
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
    }
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

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-orange-100 text-orange-800",
      urgent: "bg-red-100 text-red-800"
    };
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {/* Chat Bot Toggle Button */}
      {!isOpen && (
        <div className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 ${className}`}>
          <Button
            onClick={() => setIsOpen(true)}
            className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg transition-all duration-200 hover:scale-105"
            size="lg"
          >
            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </Button>
        </div>
      )}

      {/* Chat Bot Window */}
      {isOpen && (
        <div className={`fixed inset-x-4 bottom-4 md:bottom-6 md:right-6 md:left-auto md:inset-x-auto z-50 ${className}`}>
          <div className={`bg-white rounded-lg shadow-2xl border transition-all duration-200 ${
            isMinimized 
              ? 'w-full md:w-80 h-16' 
              : 'w-full md:w-96 h-[calc(100vh-2rem)] md:h-[500px] max-h-[600px]'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5" />
                <span className="font-medium">客服助手</span>
                {currentSession && !isMinimized && (
                  <Badge variant="secondary" className="text-xs">
                    {getCategoryLabel(currentSession.category)}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="text-white hover:bg-blue-700 h-8 w-8 p-0"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-blue-700 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            {!isMinimized && (
              <div className="flex flex-col h-[436px]">
                {!currentSession ? (
                  /* New Session Form */
                  <div className="p-4 space-y-4 flex-1">
                    <div className="text-center mb-4">
                      <h3 className="font-medium text-slate-900 mb-2">開始新對話</h3>
                      <p className="text-sm text-slate-600">
                        描述您遇到的問題，我們會盡快為您處理
                      </p>
                    </div>

                    {/* Previous sessions */}
                    {sessions.length > 0 && (
                      <div className="mb-4">
                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                          或選擇現有對話
                        </label>
                        <ScrollArea className="h-24">
                          <div className="space-y-2">
                            {sessions.slice(0, 3).map((session: ChatSession) => (
                              <div
                                key={session.id}
                                onClick={() => setCurrentSession(session)}
                                className="p-2 border rounded cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium truncate">
                                    {session.title}
                                  </span>
                                  {getStatusIcon(session.status)}
                                </div>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge className={`text-xs ${getPriorityColor(session.priority)}`}>
                                    {session.priority}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {getCategoryLabel(session.category)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                          問題標題 *
                        </label>
                        <Input
                          value={newSessionData.title}
                          onChange={(e) => setNewSessionData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="簡要描述您的問題..."
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                          問題類型
                        </label>
                        <Select
                          value={newSessionData.category}
                          onValueChange={(value) => setNewSessionData(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">一般問題</SelectItem>
                            <SelectItem value="bug">錯誤回報</SelectItem>
                            <SelectItem value="feature">功能建議</SelectItem>
                            <SelectItem value="question">使用問題</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                          優先級
                        </label>
                        <Select
                          value={newSessionData.priority}
                          onValueChange={(value) => setNewSessionData(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">低</SelectItem>
                            <SelectItem value="medium">中</SelectItem>
                            <SelectItem value="high">高</SelectItem>
                            <SelectItem value="urgent">緊急</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={handleCreateSession}
                        disabled={createSessionMutation.isPending}
                        className="w-full"
                      >
                        開始對話
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Chat Messages */
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.map((message: ChatMessage) => (
                          <div
                            key={message.id}
                            className={`flex ${message.messageType === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-lg p-3 ${
                              message.messageType === 'user' 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-slate-100 text-slate-900'
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
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <div className="p-4 border-t">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentSession(null)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          ← 返回
                        </Button>
                        <div className="flex-1 flex items-center space-x-2">
                          <Input
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            placeholder="輸入訊息..."
                            className="flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />
                          <Button
                            onClick={handleSendMessage}
                            disabled={!currentMessage.trim() || sendMessageMutation.isPending}
                            size="sm"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}