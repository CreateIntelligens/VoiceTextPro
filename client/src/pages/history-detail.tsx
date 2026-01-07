import { useState } from "react";
import { useQuery, useQueryClient as useQueryClientHook } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Copy,
  FileText,
  Clock,
  Users,
  TrendingUp,
  Brain,
  Music,
  FileDown,
  Loader2,
  Target,
  MessageSquare,
  Lightbulb,
  User,
  Plus,
  X,
  Edit2,
  Check,
  ChevronDown,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import type { TranscriptionStatus, RDAnalysisResult } from "@/lib/types";
import RDAnalysis from "@/components/rd-analysis";
import AIAnalysisDialog from "@/components/ai-analysis-dialog";

export default function HistoryDetailPage() {
  const [, params] = useRoute("/history/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClientHook();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRDAnalyzing, setIsRDAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcript' | 'cleaned' | 'analysis'>('transcript');

  // AI 分析 Dialog 狀態
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState<number | null>(null);
  const [editingSpeakerName, setEditingSpeakerName] = useState('');

  // 語者編輯相關 state
  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
  const [isUpdatingSpeaker, setIsUpdatingSpeaker] = useState(false);
  const [showAddSpeakerDialog, setShowAddSpeakerDialog] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [pendingSegmentIndex, setPendingSegmentIndex] = useState<number | null>(null);
  const [showBatchSpeakerDialog, setShowBatchSpeakerDialog] = useState(false);

  const transcriptionId = params?.id ? parseInt(params.id) : null;

  const { data: transcription, refetch } = useQuery<TranscriptionStatus>({
    queryKey: [`/api/transcriptions/${transcriptionId}`],
    enabled: !!transcriptionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // 如果正在處理中，每 1.5 秒刷新一次
      if (status === "processing" || status === "pending") {
        return 1500;
      }
      return false;
    },
  });

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyTranscript = async () => {
    if (!transcription?.segments) return;

    const fullText = transcription.segments
      .map((segment: any) => {
        const speakerLabel = transcription.speakers?.find((s: any) => s.id === segment.speaker)?.label || segment.speaker || '未知講者';
        return `${speakerLabel}: ${segment.text}`;
      })
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(fullText);
      toast({ title: "已複製", description: "轉錄內容已複製到剪貼簿" });
    } catch (error) {
      toast({ title: "複製失敗", description: "無法複製到剪貼簿", variant: "destructive" });
    }
  };

  const handleDownloadText = () => {
    if (!transcription?.segments) return;

    const fullText = transcription.segments
      .map((segment: any) => {
        const speakerLabel = transcription.speakers?.find((s: any) => s.id === segment.speaker)?.label || segment.speaker || '未知講者';
        return `[${segment.timestamp || ''}] ${speakerLabel}: ${segment.text}`;
      })
      .join('\n\n');

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `轉錄_${transcription.originalName || transcription.filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadWord = async () => {
    if (!transcription?.segments) return;

    try {
      const children = [
        new Paragraph({ text: "語音轉錄報告", heading: HeadingLevel.TITLE }),
        new Paragraph({
          children: [
            new TextRun({ text: "檔案名稱: ", bold: true }),
            new TextRun({ text: transcription.originalName || transcription.filename }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "轉錄時間: ", bold: true }),
            new TextRun({ text: formatDate(transcription.createdAt) }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "轉錄內容", heading: HeadingLevel.HEADING_1 }),
      ];

      transcription.segments.forEach((segment: any) => {
        const speakerLabel = transcription.speakers?.find((s: any) => s.id === segment.speaker)?.label || segment.speaker || '未知講者';
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${speakerLabel}: `, bold: true }),
              new TextRun({ text: segment.text }),
            ],
            spacing: { after: 200 },
          })
        );
      });

      if (transcription.summary) {
        children.push(
          new Paragraph({ text: "" }),
          new Paragraph({ text: "AI 摘要", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: transcription.summary })
        );
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `轉錄_${transcription.originalName || transcription.filename}.docx`);
      toast({ title: "下載成功", description: "Word 文檔已下載" });
    } catch (error) {
      toast({ title: "下載失敗", description: "無法生成 Word 文檔", variant: "destructive" });
    }
  };

  const handleDownloadAudio = async () => {
    if (!transcription) return;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        toast({ title: "下載失敗", description: "請先登入", variant: "destructive" });
        return;
      }
      // Use direct link with token for large file downloads
      const downloadUrl = `/api/transcriptions/${transcription.id}/download-audio?token=${encodeURIComponent(token)}`;
      window.open(downloadUrl, '_blank');
      toast({ title: "下載開始", description: "音頻檔案正在下載" });
    } catch (error) {
      toast({ title: "下載失敗", description: "無法下載音頻檔案", variant: "destructive" });
    }
  };

  const handleAIAnalysis = async () => {
    if (!transcription) return;

    setIsAnalyzing(true);
    try {
      await apiRequest(`/api/transcriptions/${transcription.id}/analyze`, 'POST');
      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      refetch();
      toast({ title: "分析完成", description: "AI 智能分析已完成" });
    } catch (error) {
      toast({ title: "分析失敗", description: "無法完成 AI 分析，請稍後再試", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRDAnalysis = async () => {
    if (!transcription) return;

    setIsRDAnalyzing(true);
    try {
      const result = await apiRequest(`/api/transcriptions/${transcription.id}/analyze-rd`, 'POST', {
        useMultimodal: true
      });
      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      refetch();

      const hasCleanedSegments = transcription.cleanedSegments && transcription.cleanedSegments.length > 0;
      toast({
        title: "RD 分析完成",
        description: hasCleanedSegments
          ? "已產出技術文檔和圖表"
          : "已完成多模態語者識別並產出技術文檔"
      });
    } catch (error: any) {
      toast({
        title: "RD 分析失敗",
        description: error.message || "無法完成 RD 分析，請稍後再試",
        variant: "destructive"
      });
    } finally {
      setIsRDAnalyzing(false);
    }
  };

  // AI 分析完成後的回調
  const handleAnalysisComplete = () => {
    qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription?.id}`] });
    refetch();
    setActiveTab('analysis'); // 自動切換到分析結果 Tab
    toast({
      title: "AI 分析完成",
      description: "已完成語者識別和內容分析"
    });
  };

  const startSpeakerEdit = (speakerName: string, index: number) => {
    setEditingSpeakerIndex(index);
    setEditingSpeakerName(speakerName);
  };

  const cancelSpeakerEdit = () => {
    setEditingSpeakerIndex(null);
    setEditingSpeakerName('');
  };

  const saveSpeakerEdit = async () => {
    if (!transcription || editingSpeakerIndex === null) return;

    try {
      const updatedSpeakers = transcription.speakers?.map((speaker: any, index: number) => {
        if (index === editingSpeakerIndex) {
          return { ...speaker, label: editingSpeakerName };
        }
        return speaker;
      }) || [];

      const oldSpeakerName = transcription.speakers?.[editingSpeakerIndex]?.label ||
                            transcription.speakers?.[editingSpeakerIndex];
      const updatedCleanedSegments = transcription.cleanedSegments?.map((segment: any) => {
        if (segment.speaker === oldSpeakerName) {
          return { ...segment, speaker: editingSpeakerName };
        }
        return segment;
      }) || [];

      await apiRequest(`/api/transcriptions/${transcription.id}`, 'PATCH', {
        speakers: updatedSpeakers,
        cleanedSegments: updatedCleanedSegments,
      });

      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      refetch();
      toast({ title: "更新成功", description: "語者名稱已更新" });
      cancelSpeakerEdit();
    } catch (error) {
      toast({ title: "更新失敗", description: "無法更新語者名稱", variant: "destructive" });
    }
  };

  const deleteSpeaker = async (speakerIndex: number) => {
    if (!transcription) return;

    const speakerToDelete = transcription.speakers?.[speakerIndex];
    const speakerName = typeof speakerToDelete === 'string'
      ? speakerToDelete
      : speakerToDelete?.label || `講者 ${speakerIndex + 1}`;

    try {
      const updatedSpeakers = transcription.speakers?.filter((_: any, index: number) => index !== speakerIndex) || [];
      const updatedCleanedSegments = transcription.cleanedSegments?.filter((segment: any) => {
        return segment.speaker !== speakerName;
      }) || [];

      await apiRequest(`/api/transcriptions/${transcription.id}`, 'PATCH', {
        speakers: updatedSpeakers,
        cleanedSegments: updatedCleanedSegments,
      });

      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      refetch();
      toast({ title: "刪除成功", description: `已刪除語者「${speakerName}」及其相關段落` });
    } catch (error) {
      toast({ title: "刪除失敗", description: "無法刪除語者", variant: "destructive" });
    }
  };

  // 更新單段語者
  const updateSegmentSpeaker = async (segmentIndex: number, newSpeaker: string) => {
    if (!transcription) return;

    setIsUpdatingSpeaker(true);
    try {
      await apiRequest(`/api/transcriptions/${transcription.id}/segments/${segmentIndex}/speaker`, 'PATCH', {
        speaker: newSpeaker
      });
      // 強制刷新資料
      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      await qc.refetchQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      toast({ title: "語者已更新", description: `已將此段對話的語者更改為「${newSpeaker}」` });
    } catch (error: any) {
      toast({
        title: "更新失敗",
        description: error.message || "無法更新語者",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingSpeaker(false);
    }
  };

  // 批次更新語者
  const batchUpdateSpeakers = async (newSpeaker: string) => {
    if (!transcription || selectedSegments.size === 0) return;

    setIsUpdatingSpeaker(true);
    try {
      const updates = Array.from(selectedSegments).map(segmentIndex => ({
        segmentIndex,
        speaker: newSpeaker
      }));

      await apiRequest(`/api/transcriptions/${transcription.id}/segments/batch-speaker`, 'PATCH', {
        updates
      });
      // 強制刷新資料
      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      await qc.refetchQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      setSelectedSegments(new Set());
      setShowBatchSpeakerDialog(false);
      toast({ title: "批次更新完成", description: `已將 ${updates.length} 段對話的語者更改為「${newSpeaker}」` });
    } catch (error: any) {
      toast({
        title: "批次更新失敗",
        description: error.message || "無法批次更新語者",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingSpeaker(false);
    }
  };

  // 新增語者並更新段落
  const addNewSpeakerAndUpdate = async () => {
    if (!transcription || !newSpeakerName.trim()) return;

    // 先更新語者清單
    const currentSpeakers = transcription.speakers as any[] || [];
    const speakerColors = ['#0abdc6', '#ea00d9', '#05ffa1', '#f0e130', '#711c91', '#ff2a6d'];
    const newSpeaker = {
      id: `speaker_${currentSpeakers.length + 1}`,
      label: newSpeakerName.trim(),
      color: speakerColors[currentSpeakers.length % speakerColors.length]
    };

    try {
      // 更新語者清單
      await apiRequest(`/api/transcriptions/${transcription.id}`, 'PATCH', {
        speakers: [...currentSpeakers, newSpeaker]
      });

      // 如果有指定要更新的段落，也一併更新
      if (pendingSegmentIndex !== null) {
        await updateSegmentSpeaker(pendingSegmentIndex, newSpeakerName.trim());
      } else if (selectedSegments.size > 0) {
        await batchUpdateSpeakers(newSpeakerName.trim());
      }

      await qc.invalidateQueries({ queryKey: [`/api/transcriptions/${transcription.id}`] });
      refetch();
      setShowAddSpeakerDialog(false);
      setNewSpeakerName('');
      setPendingSegmentIndex(null);
      toast({ title: "新增成功", description: `已新增語者「${newSpeakerName.trim()}」` });
    } catch (error: any) {
      toast({
        title: "新增失敗",
        description: error.message || "無法新增語者",
        variant: "destructive"
      });
    }
  };

  // 切換段落選取
  const toggleSegmentSelection = (index: number) => {
    setSelectedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (!transcription?.cleanedSegments) return;
    const allSegments = transcription.cleanedSegments as any[];
    if (selectedSegments.size === allSegments.length) {
      setSelectedSegments(new Set());
    } else {
      setSelectedSegments(new Set(allSegments.map((_, i) => i)));
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'todo': '待辦',
      'decision': '決策',
      'commitment': '承諾',
      'deadline': '時間節點',
      'followup': '追蹤'
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#22c55e'
    };
    return colors[priority] || '#6b7280';
  };

  if (!transcription) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const isProcessing = transcription.status === 'processing' || transcription.status === 'pending';
  const speakerColors = ['#0abdc6', '#ea00d9', '#05ffa1', '#f0e130', '#711c91', '#ff2a6d'];

  // 處理中狀態 - 顯示進度
  if (isProcessing) {
    const progress = transcription.progress || 0;
    const steps = [
      { label: "音頻檔案上傳完成", completed: progress >= 10 },
      { label: "正在進行語音識別", completed: progress >= 50, current: progress >= 10 && progress < 50 },
      { label: "識別對話者", completed: progress >= 80, current: progress >= 50 && progress < 80 },
      { label: "轉錄完成", completed: progress >= 100, current: progress >= 80 && progress < 100 },
    ];

    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <header className="pt-4 pb-3 px-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setLocation('/history')}
                className="p-2 -ml-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-foreground truncate">
                  {transcription.displayName || transcription.originalName || transcription.filename}
                </h1>
                <p className="text-xs text-muted-foreground">{formatDate(transcription.createdAt)}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6">
          {/* Processing Card */}
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Music className="w-7 h-7 text-primary" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    正在處理音頻
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    AI 智能語音模型轉錄中...
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Section */}
            <div className="p-5">
              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-foreground">轉錄進度</span>
                  <span className="text-lg font-bold text-primary">{progress}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-4">
                    {/* Step Icon */}
                    {step.completed ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : step.current ? (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                      </div>
                    )}

                    {/* Step Label */}
                    <span
                      className={`text-sm ${
                        step.completed
                          ? "text-emerald-500 font-medium"
                          : step.current
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                      {step.current && "..."}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Info */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            處理完成後將自動顯示轉錄結果
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="pt-4 pb-3 px-4 sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setLocation('/history')}
              className="p-2 -ml-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {transcription.displayName || transcription.originalName || transcription.filename}
              </h1>
              <p className="text-xs text-muted-foreground">{formatDate(transcription.createdAt)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="flex items-center justify-between py-3 mb-4">
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  {transcription.duration ? formatDuration(transcription.duration) : '--'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">時長</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <FileText className="w-3.5 h-3.5 text-secondary" />
                <span className="text-sm font-semibold text-foreground">
                  {transcription.wordCount?.toLocaleString() || '--'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">字數</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-sm font-semibold text-foreground">
                  {transcription.confidence ? Math.round(transcription.confidence * 100) : '--'}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">準確度</p>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1">
                <Users className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">
                  {transcription.speakers?.length || '--'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">講者</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          {transcription.analysisMode === 'rd' ? (
            <Button
              onClick={handleRDAnalysis}
              disabled={isRDAnalyzing || (!transcription.cleanedTranscriptText && !transcription.transcriptText)}
              className="flex-1 h-10 rounded-xl"
            >
              {isRDAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
              RD 分析
            </Button>
          ) : (
            <Button
              onClick={() => setShowAnalysisDialog(true)}
              className="flex-1 h-10 rounded-xl"
            >
              <Brain className="w-4 h-4 mr-2" />
              AI 分析
            </Button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={handleCopyTranscript} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Copy className="w-3.5 h-3.5" />
            <span>複製</span>
          </button>
          <button onClick={handleDownloadText} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Download className="w-3.5 h-3.5" />
            <span>文字檔</span>
          </button>
          <button onClick={handleDownloadWord} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <FileDown className="w-3.5 h-3.5" />
            <span>Word</span>
          </button>
          <button onClick={handleDownloadAudio} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <Music className="w-3.5 h-3.5" />
            <span>音頻</span>
          </button>
        </div>

        {/* Content Tabs */}
        <div className="flex p-1 mb-4 bg-muted/30 rounded-xl">
          {/* RD 模式只顯示原始逐字稿和 AI 分析，會議模式顯示全部三個 Tab */}
          {(transcription.analysisMode === 'rd'
            ? ['transcript', 'analysis'] as const
            : ['transcript', 'cleaned', 'analysis'] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'transcript' ? '原始逐字稿' : tab === 'cleaned' ? '逐字稿整理' : 'AI 分析'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {transcription.speakers && transcription.speakers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {transcription.speakers.map((speaker: any, index: number) => {
                  const speakerName = typeof speaker === 'string' ? speaker : speaker.label || speaker.name || `講者 ${index + 1}`;
                  const color = typeof speaker === 'string' ? speakerColors[index % speakerColors.length] : speaker.color || speakerColors[index % speakerColors.length];
                  return (
                    <span
                      key={index}
                      className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs"
                      style={{ border: `1px solid ${color}`, color }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span>{speakerName}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {transcription.segments && transcription.segments.length > 0 ? (
              transcription.segments.map((segment: any, index: number) => {
                let speakerColor = speakerColors[0];
                let speakerName = segment.speaker || '未知講者';

                if (transcription.speakers && Array.isArray(transcription.speakers)) {
                  if (typeof transcription.speakers[0] === 'string') {
                    const speakerIndex = transcription.speakers.indexOf(segment.speaker);
                    speakerColor = speakerColors[speakerIndex >= 0 ? speakerIndex % speakerColors.length : 0];
                  } else {
                    const speakerObj = transcription.speakers.find((s: any) => s.id === segment.speaker);
                    if (speakerObj) {
                      speakerColor = speakerObj.color || speakerColors[0];
                      speakerName = speakerObj.label || speakerObj.name || segment.speaker;
                    }
                  }
                }

                return (
                  <div key={index} className="p-3 rounded-xl bg-card/50 border-l-2" style={{ borderLeftColor: speakerColor }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: speakerColor }}>{speakerName}</span>
                      {segment.timestamp && <span className="text-[10px] text-muted-foreground">{segment.timestamp}</span>}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{segment.text}</p>
                  </div>
                );
              })
            ) : transcription.transcriptText ? (
              <div className="p-4 rounded-xl bg-card/50">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{transcription.transcriptText}</p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">暫無轉錄內容</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cleaned' && (
          <div className="space-y-3">
            {transcription.speakers && transcription.speakers.length > 0 && (
              <div className="p-4 rounded-xl bg-card/50 border border-border/50 mb-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">語者標識（點擊可編輯）</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {transcription.speakers.map((speaker: any, index: number) => {
                    const speakerName = typeof speaker === 'string' ? speaker : speaker.label || `講者 ${index + 1}`;
                    const color = typeof speaker === 'string' ? speakerColors[index % speakerColors.length] : speaker.color || speakerColors[index % speakerColors.length];

                    return editingSpeakerIndex === index ? (
                      <div key={index} className="flex items-center gap-1 p-1 rounded-lg" style={{ border: `1px solid ${color}` }}>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <Input
                          value={editingSpeakerName}
                          onChange={(e) => setEditingSpeakerName(e.target.value)}
                          className="w-20 h-6 text-xs px-1 bg-transparent border-0"
                          autoFocus
                        />
                        <button onClick={saveSpeakerEdit} className="p-1 hover:bg-emerald-500/20 rounded">
                          <Check className="w-3 h-3 text-emerald-500" />
                        </button>
                        <button onClick={cancelSpeakerEdit} className="p-1 hover:bg-destructive/20 rounded">
                          <X className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ) : (
                      <div key={index} className="flex items-center gap-1">
                        <button
                          onClick={() => startSpeakerEdit(speakerName, index)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs hover:opacity-80 transition-opacity"
                          style={{ border: `1px solid ${color}`, color }}
                        >
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span>{speakerName}</span>
                          <Edit2 className="w-2.5 h-2.5 opacity-50" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`確定要刪除語者「${speakerName}」及其所有對話嗎？`)) {
                              deleteSpeaker(index);
                            }
                          }}
                          className="p-1 rounded hover:bg-destructive/20"
                        >
                          <X className="w-3 h-3 text-destructive/70" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {transcription.cleanedSegments && Array.isArray(transcription.cleanedSegments) && transcription.cleanedSegments.length > 0 ? (
              <>
                {/* 批次操作工具列 */}
                <div className="flex items-center justify-between mb-3 p-2 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {selectedSegments.size === (transcription.cleanedSegments as any[]).length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {selectedSegments.size > 0 ? `已選 ${selectedSegments.size} 段` : '全選'}
                    </button>
                  </div>
                  {selectedSegments.size > 0 && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSegments(new Set())}
                        className="h-7 text-xs"
                      >
                        取消
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowBatchSpeakerDialog(true)}
                        className="h-7 text-xs gap-1"
                      >
                        <Users className="w-3 h-3" />
                        變更語者
                      </Button>
                    </div>
                  )}
                </div>

                {/* 對話段落列表 */}
                {transcription.cleanedSegments.map((segment: any, index: number) => {
                  let speakerColor = speakerColors[0];
                  let speakerName = segment.speaker || '未知講者';
                  const isSelected = selectedSegments.has(index);

                  if (transcription.speakers && Array.isArray(transcription.speakers)) {
                    const speakerIndex = transcription.speakers.findIndex((s: any) => {
                      const label = typeof s === 'string' ? s : s.label;
                      return label === segment.speaker;
                    });
                    if (speakerIndex >= 0) {
                      const speaker = transcription.speakers[speakerIndex];
                      speakerColor = typeof speaker === 'string'
                        ? speakerColors[speakerIndex % speakerColors.length]
                        : speaker.color || speakerColors[speakerIndex % speakerColors.length];
                    }
                  }

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-xl border-l-2 transition-colors ${
                        isSelected ? 'bg-primary/10 border-primary' : 'bg-card/50'
                      }`}
                      style={{ borderLeftColor: isSelected ? undefined : speakerColor }}
                    >
                      <div className="flex items-start gap-2">
                        {/* 選取 Checkbox */}
                        <button
                          onClick={() => toggleSegmentSelection(index)}
                          className="mt-0.5 flex-shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* 語者下拉選單 */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="text-xs font-medium mb-1 flex items-center gap-1 hover:opacity-80 transition-opacity disabled:opacity-50"
                                style={{ color: speakerColor }}
                                disabled={isUpdatingSpeaker}
                              >
                                {speakerName}
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              {transcription.speakers?.map((speaker: any, speakerIdx: number) => {
                                const label = typeof speaker === 'string' ? speaker : speaker.label;
                                const color = typeof speaker === 'string'
                                  ? speakerColors[speakerIdx % speakerColors.length]
                                  : speaker.color || speakerColors[speakerIdx % speakerColors.length];
                                const isCurrent = label === speakerName;

                                return (
                                  <DropdownMenuItem
                                    key={speakerIdx}
                                    onClick={() => !isCurrent && updateSegmentSpeaker(index, label)}
                                    className={isCurrent ? 'bg-muted' : ''}
                                  >
                                    <div
                                      className="w-2 h-2 rounded-full mr-2"
                                      style={{ backgroundColor: color }}
                                    />
                                    {label}
                                    {isCurrent && <Check className="w-3 h-3 ml-auto" />}
                                  </DropdownMenuItem>
                                );
                              })}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setPendingSegmentIndex(index);
                                  setShowAddSpeakerDialog(true);
                                }}
                              >
                                <Plus className="w-3 h-3 mr-2" />
                                新增語者
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          {/* 對話內容 */}
                          <p className="text-sm text-foreground leading-relaxed">{segment.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : transcription.cleanedTranscriptText ? (
              <div className="p-4 rounded-xl bg-card/50">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{transcription.cleanedTranscriptText}</p>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Wand2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">尚未進行逐字稿整理</p>
                <p className="text-xs text-muted-foreground/70 mt-1">請先設定與會者，再點擊「整理逐字稿」按鈕</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && (
          <>
            {/* RD Mode Analysis */}
            {transcription.analysisMode === 'rd' ? (
              transcription.rdAnalysis ? (
                <RDAnalysis
                  analysis={transcription.rdAnalysis as RDAnalysisResult}
                  onExportMarkdown={() => {
                    // TODO: Implement Markdown export
                    toast({ title: "功能開發中", description: "Markdown 匯出即將推出" });
                  }}
                  onExportJSON={() => {
                    const blob = new Blob([JSON.stringify(transcription.rdAnalysis, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rd-analysis-${transcription.id}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    toast({ title: "下載成功", description: "RD 分析已匯出為 JSON" });
                  }}
                />
              ) : (
                <div className="py-12 text-center">
                  <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">尚未進行 RD 分析</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">請先整理逐字稿，再點擊「RD 分析」按鈕</p>
                </div>
              )
            ) : (
              /* Meeting Mode Analysis */
              <div className="space-y-4">
                {/* Summary */}
                {transcription.summary && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-center space-x-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-primary">內容摘要</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{transcription.summary}</p>
                  </div>
                )}

                {/* Action Items */}
                {transcription.actionItems && Array.isArray(transcription.actionItems) && transcription.actionItems.length > 0 && (
                  <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Target className="w-4 h-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">重點追蹤事項</span>
                    </div>
                    <div className="space-y-2">
                      {transcription.actionItems.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg bg-background/50 border-l-2"
                          style={{ borderLeftColor: getPriorityColor(item.priority) }}
                        >
                          <div className="flex items-center flex-wrap gap-2 mb-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                              {getTypeLabel(item.type)}
                            </span>
                            {item.assignee && (
                              <span className="text-[10px] text-muted-foreground flex items-center">
                                <User className="w-2.5 h-2.5 mr-0.5" />
                                {item.assignee}
                              </span>
                            )}
                            {item.dueDate && (
                              <span className="text-[10px] text-muted-foreground flex items-center">
                                <Clock className="w-2.5 h-2.5 mr-0.5" />
                                {item.dueDate}
                              </span>
                            )}
                            {item.priority && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: `${getPriorityColor(item.priority)}20`, color: getPriorityColor(item.priority) }}
                              >
                                {item.priority === 'high' ? '高' : item.priority === 'medium' ? '中' : '低'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Speaker Analysis */}
                {transcription.speakerAnalysis && (
                  <div className="p-4 rounded-xl bg-secondary/5 border border-secondary/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Users className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium text-secondary">講者分析</span>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(transcription.speakerAnalysis).map(([speaker, analysis]: [string, any]) => (
                        <div key={speaker} className="p-3 rounded-lg bg-background/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-foreground flex items-center">
                              <User className="w-3.5 h-3.5 mr-1.5 text-secondary" />
                              {speaker}
                            </span>
                            {(analysis.參與度 || analysis.participation) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/10 text-secondary">
                                參與度: {analysis.參與度 || analysis.participation}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {(analysis.發言特點 || analysis.characteristics) && (
                              <p><span className="text-foreground">發言特點：</span>{analysis.發言特點 || analysis.characteristics}</p>
                            )}
                            {(analysis.主要觀點 || analysis.mainPoints) && (
                              <p><span className="text-foreground">主要觀點：</span>{analysis.主要觀點 || analysis.mainPoints}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Topics */}
                {transcription.topicsDetection && Array.isArray(transcription.topicsDetection) && transcription.topicsDetection.length > 0 && (
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Target className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-500">關鍵主題</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(transcription.topicsDetection as any[]).map((topic: any, index: number) => (
                        <span key={index} className="px-2 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {typeof topic === 'string' ? topic : topic.topic || topic.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Auto Highlights */}
                {transcription.autoHighlights && Array.isArray(transcription.autoHighlights) && transcription.autoHighlights.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center space-x-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-500">重點摘錄</span>
                    </div>
                    <div className="space-y-2">
                      {(transcription.autoHighlights as any[]).map((highlight: any, index: number) => (
                        <div key={index} className="p-2 rounded-lg bg-background/50 border-l-2 border-amber-500">
                          <p className="text-sm text-foreground">
                            {typeof highlight === 'string' ? highlight : highlight.text || highlight.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Analysis Yet */}
                {!transcription.summary && !transcription.entityDetection && !transcription.topicsDetection && (
                  <div className="py-12 text-center">
                    <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">尚未進行 AI 分析</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">點擊上方「AI 分析」按鈕開始</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* 新增語者 Dialog */}
      <Dialog open={showAddSpeakerDialog} onOpenChange={setShowAddSpeakerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增語者</DialogTitle>
            <DialogDescription>
              輸入新語者的名稱，將會新增到語者清單並更新選取的段落。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newSpeakerName">語者名稱</Label>
              <Input
                id="newSpeakerName"
                placeholder="例如：張經理"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSpeakerName.trim()) {
                    addNewSpeakerAndUpdate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSpeakerDialog(false);
                setNewSpeakerName('');
                setPendingSegmentIndex(null);
              }}
            >
              取消
            </Button>
            <Button
              onClick={addNewSpeakerAndUpdate}
              disabled={!newSpeakerName.trim()}
            >
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批次變更語者 Dialog */}
      <Dialog open={showBatchSpeakerDialog} onOpenChange={setShowBatchSpeakerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批次變更語者</DialogTitle>
            <DialogDescription>
              選擇要將 {selectedSegments.size} 段對話變更為哪位語者。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
            {transcription?.speakers?.map((speaker: any, idx: number) => {
              const label = typeof speaker === 'string' ? speaker : speaker.label;
              const color = typeof speaker === 'string'
                ? speakerColors[idx % speakerColors.length]
                : speaker.color || speakerColors[idx % speakerColors.length];

              return (
                <button
                  key={idx}
                  onClick={() => batchUpdateSpeakers(label)}
                  disabled={isUpdatingSpeaker}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowBatchSpeakerDialog(false);
                setShowAddSpeakerDialog(true);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left border-t mt-2 pt-3"
            >
              <Plus className="w-3 h-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">新增語者</span>
            </button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBatchSpeakerDialog(false)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 分析 Dialog */}
      <AIAnalysisDialog
        transcription={transcription}
        isOpen={showAnalysisDialog}
        onClose={() => setShowAnalysisDialog(false)}
        onComplete={handleAnalysisComplete}
      />
    </div>
  );
}
