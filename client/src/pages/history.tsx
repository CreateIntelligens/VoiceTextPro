import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus } from "@/lib/types";

export default function HistoryPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: transcriptions = [], refetch, isLoading } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
  });

  const filteredTranscriptions = transcriptions.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.filename?.toLowerCase().includes(query) ||
      t.originalName?.toLowerCase().includes(query) ||
      t.transcriptText?.toLowerCase().includes(query)
    );
  });

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`/api/transcriptions/${deleteId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('刪除失敗');
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
      toast({ title: "已刪除" });
    } catch (error) {
      toast({ title: "刪除失敗", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // 按日期分組
  const groupByDate = (items: TranscriptionStatus[]) => {
    const groups: { [key: string]: TranscriptionStatus[] } = {};

    items.forEach(item => {
      const date = new Date(item.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = '今天';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = '昨天';
      } else {
        key = date.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  };

  const groupedTranscriptions = groupByDate(filteredTranscriptions);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="pt-6 pb-4 px-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-semibold text-foreground mb-4">記錄</h1>

          {/* 搜尋欄 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-xl bg-muted/30 border-0 focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filteredTranscriptions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "找不到符合的記錄" : "尚無轉錄記錄"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setLocation('/')} variant="default" size="sm">
                開始轉錄
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTranscriptions).map(([date, items]) => (
              <section key={date}>
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {date}
                </h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setLocation(`/history/${item.id}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center py-3 px-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-200">
                        {/* 狀態圖標 */}
                        <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center mr-3 flex-shrink-0">
                          {getStatusIcon(item.status)}
                        </div>

                        {/* 內容 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {item.displayName || item.originalName || item.filename}
                          </p>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(item.createdAt)}
                            </span>
                            {item.duration && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(item.duration)}
                                </span>
                              </>
                            )}
                            {item.wordCount && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.wordCount.toLocaleString()}字
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* 操作 */}
                        <div className="flex items-center space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(item.id);
                            }}
                            className="p-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* 刪除確認 */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>刪除記錄？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法撤銷
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 rounded-xl"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
