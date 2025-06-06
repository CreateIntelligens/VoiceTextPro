import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Calendar, CheckCircle, Clock, AlertCircle, Edit2, Trash2, FileAudio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TranscriptionStatus } from "@/lib/types";

interface TranscriptionListProps {
  transcriptions: TranscriptionStatus[];
  onSelectTranscription: (id: number) => void;
  selectedId?: number;
}

export default function TranscriptionList({ 
  transcriptions, 
  onSelectTranscription, 
  selectedId 
}: TranscriptionListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, displayName }: { id: number; displayName: string }) => {
      const response = await apiRequest(`/api/transcriptions/${id}`, "PATCH", { displayName });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      setEditingId(null);
      toast({
        title: "更新成功",
        description: "轉錄記錄名稱已更新",
      });
    },
    onError: (error) => {
      toast({
        title: "更新失敗",
        description: error instanceof Error ? error.message : "無法更新轉錄記錄名稱",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/transcriptions/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      toast({
        title: "刪除成功",
        description: "轉錄記錄已刪除",
      });
    },
    onError: (error) => {
      toast({
        title: "刪除失敗",
        description: error instanceof Error ? error.message : "無法刪除轉錄記錄",
        variant: "destructive",
      });
    },
  });

  const startEdit = (transcription: TranscriptionStatus) => {
    setEditingId(transcription.id);
    setEditingName(transcription.displayName || transcription.originalName || transcription.filename);
  };

  const saveEdit = () => {
    if (editingId && editingName.trim()) {
      updateNameMutation.mutate({ id: editingId, displayName: editingName.trim() });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = (id: number) => {
    if (confirm("確定要刪除這個轉錄記錄嗎？此操作無法復原。")) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">已完成</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">處理中</Badge>;
      case 'error':
        return <Badge variant="destructive">錯誤</Badge>;
      default:
        return <Badge variant="secondary">待處理</Badge>;
    }
  };

  if (!transcriptions || transcriptions.length === 0) {
    return (
      <Card className="mb-8">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <FileAudio className="w-12 h-12 text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">尚無轉錄記錄</h3>
          <p className="text-slate-500 text-center">
            上傳您的第一個音頻檔案開始使用語音轉錄服務
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">轉錄記錄</h2>
      {transcriptions.map((transcription) => (
        <Card 
          key={transcription.id}
          className={`cursor-pointer transition-colors hover:border-blue-300 ${
            selectedId === transcription.id ? 'border-blue-500 bg-blue-50' : ''
          }`}
          onClick={(e) => {
            if (editingId === transcription.id) {
              e.preventDefault();
              return;
            }
            onSelectTranscription(transcription.id);
          }}
        >
          <CardContent className="p-4">
            {editingId === transcription.id ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(transcription.status)}
                  <span className="text-sm text-slate-600">重新命名轉錄記錄</span>
                </div>
                <div className="space-y-2">
                  <Input
                    value={editingName}
                    onChange={(e) => {
                      e.stopPropagation();
                      setEditingName(e.target.value);
                    }}
                    className="w-full"
                    placeholder="輸入新的檔案名稱..."
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onBlur={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        saveEdit();
                      }}
                      disabled={updateNameMutation.isPending}
                      className="flex-1"
                    >
                      儲存
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      className="flex-1"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getStatusIcon(transcription.status)}
                  <div className="flex-1 min-w-0">
                    <div>
                      <h3 className="font-medium text-slate-900 truncate">
                        {transcription.displayName || transcription.originalName}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(transcription.createdAt)}</span>
                        </div>
                        <span>{formatFileSize(transcription.fileSize)}</span>
                        {transcription.status === "processing" && (
                          <span className="text-blue-600">{transcription.progress}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {getStatusBadge(transcription.status)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        startEdit(transcription);
                      }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        重新命名
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(transcription.id);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        刪除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}