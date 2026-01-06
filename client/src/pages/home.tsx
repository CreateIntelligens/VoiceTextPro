import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Mic, Clock, ChevronRight, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";
import UploadSection from "@/components/upload-section";
import ProcessingSection from "@/components/processing-section";
import type { TranscriptionStatus } from "@/lib/types";

export default function HomePage() {
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<number | null>(null);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: allTranscriptions = [] } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
  });

  const { data: transcription, refetch } = useQuery<TranscriptionStatus>({
    queryKey: ["/api/transcriptions", currentTranscriptionId],
    enabled: !!currentTranscriptionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "processing" || status === "pending") {
        return 1500;
      }
      return false;
    },
    staleTime: 0,
  });

  const recentTranscriptions = allTranscriptions
    .filter(t => t.status === 'completed')
    .slice(0, 3);

  const actualTranscription = Array.isArray(transcription) ? transcription[0] : transcription;
  const showProcessing = actualTranscription?.status === "processing" || actualTranscription?.status === "pending";

  useEffect(() => {
    if (actualTranscription?.status === "completed" && currentTranscriptionId) {
      setLocation(`/history/${currentTranscriptionId}`);
      setCurrentTranscriptionId(null);
    }
  }, [actualTranscription?.status, currentTranscriptionId, setLocation]);

  const handleFileUploaded = async (transcriptionId: number) => {
    setCurrentTranscriptionId(transcriptionId);
    try {
      const response = await fetch(`/api/transcriptions/${transcriptionId}/start`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to start transcription');
      refetch();
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  };

  const handleCancelTranscription = async (id: number) => {
    try {
      const response = await fetch(`/api/transcriptions/${id}/cancel`, { method: 'POST' });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
        setCurrentTranscriptionId(null);
      }
    } catch (error) {
      console.error('Failed to cancel transcription:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '剛剛';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    if (diffHours < 24) return `${diffHours} 小時前`;
    if (diffDays < 7) return `${diffDays} 天前`;

    return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  };

  const completedCount = allTranscriptions.filter(t => t.status === 'completed').length;
  const totalWords = allTranscriptions.reduce((acc, t) => acc + (t.wordCount || 0), 0);
  const totalMinutes = Math.round(allTranscriptions.reduce((acc, t) => acc + (t.duration || 0), 0) / 60);

  return (
    <div className="min-h-screen bg-background">
      {/* 簡潔 Header */}
      <header className="pt-6 pb-2 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">語音轉錄</h1>
              <p className="text-xs text-muted-foreground">AI 智能辨識</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pb-24">
        {/* 統計概覽 - 更輕量的設計 */}
        {allTranscriptions.length > 0 && !showProcessing && (
          <div className="flex items-center justify-between py-4 mb-2">
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <span className="text-xl font-semibold text-foreground">{completedCount}</span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">記錄</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <span className="text-xl font-semibold text-foreground">{totalWords.toLocaleString()}</span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">字數</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <span className="text-xl font-semibold text-foreground">{totalMinutes}</span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">分鐘</p>
              </div>
            </div>
          </div>
        )}

        {/* 主要內容區 */}
        {showProcessing && actualTranscription ? (
          <ProcessingSection
            transcription={actualTranscription}
            onCancel={handleCancelTranscription}
          />
        ) : (
          <UploadSection
            onFileUploaded={handleFileUploaded}
            isDisabled={showProcessing}
          />
        )}

        {/* 最近記錄 - 更簡潔的列表 */}
        {recentTranscriptions.length > 0 && !showProcessing && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">最近</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/history')}
                className="text-xs text-muted-foreground hover:text-foreground h-auto py-1 px-2"
              >
                全部
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>

            <div className="space-y-2">
              {recentTranscriptions.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setLocation(`/history/${item.id}`)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center py-3 px-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card transition-all duration-200">
                    {/* 序號或狀態 */}
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center mr-3 text-sm font-medium text-muted-foreground">
                      {item.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : item.status === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      )}
                    </div>

                    {/* 內容 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {item.displayName || item.originalName || item.filename}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(item.createdAt)}
                        {item.duration && ` · ${formatDuration(item.duration)}`}
                        {item.speakers && item.speakers.length > 0 && ` · ${item.speakers.length}人`}
                      </p>
                    </div>

                    {/* 箭頭 */}
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 空狀態提示 */}
        {allTranscriptions.length === 0 && !showProcessing && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm">
              <Sparkles className="w-4 h-4" />
              <span>開始你的第一次轉錄</span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
