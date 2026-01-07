import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Loader2,
  Users,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { streamRequest, type SSEProgressEvent } from "@/lib/queryClient";
import type { TranscriptionStatus } from "@/lib/types";

interface AIAnalysisDialogProps {
  transcription: TranscriptionStatus;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "attendees" | "processing" | "completed";

const speakerColors = ['#0abdc6', '#ea00d9', '#05ffa1', '#f0e130', '#711c91', '#ff2a6d'];

export default function AIAnalysisDialog({
  transcription,
  isOpen,
  onClose,
  onComplete,
}: AIAnalysisDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("attendees");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [newAttendee, setNewAttendee] = useState("");
  const [attendeeRoles, setAttendeeRoles] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completionData, setCompletionData] = useState<{
    speakersCount: number;
    segmentsCount: number;
    hasActionItems: boolean;
    hasSummary: boolean;
  } | null>(null);

  const resetState = useCallback(() => {
    setStep("attendees");
    setAttendees([]);
    setNewAttendee("");
    setAttendeeRoles("");
    setProgress(0);
    setProgressMessage("");
    setIsProcessing(false);
    setCompletionData(null);
  }, []);

  const handleClose = () => {
    if (isProcessing) {
      toast({
        title: "正在分析中",
        description: "請等待分析完成或重新整理頁面",
        variant: "destructive",
      });
      return;
    }
    resetState();
    onClose();
  };

  const addAttendee = () => {
    const trimmed = newAttendee.trim();
    if (!trimmed) return;

    // 支援多種分隔符號（逗號、頓號、換行）
    const names = trimmed.split(/[,、\n]+/).map(n => n.trim()).filter(n => n);

    const newNames = names.filter(name => !attendees.includes(name));
    if (newNames.length > 0) {
      setAttendees([...attendees, ...newNames]);
    }
    setNewAttendee("");
  };

  const removeAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAttendee();
    }
  };

  const startAnalysis = async () => {
    setStep("processing");
    setIsProcessing(true);
    setProgress(5);
    setProgressMessage("正在準備分析...");

    try {
      await streamRequest(
        `/api/transcriptions/${transcription.id}/unified-analysis`,
        {
          attendees: attendees.length > 0 ? attendees : undefined,
          attendeeRoles: attendeeRoles.trim() || undefined,
        },
        (event: SSEProgressEvent) => {
          setProgress(event.progress);
          setProgressMessage(event.message);

          if (event.stage === "completed") {
            setCompletionData(event.data);
            setStep("completed");
            setIsProcessing(false);
          } else if (event.stage === "error") {
            throw new Error(event.message);
          }
        },
        (error: Error) => {
          console.error("SSE 錯誤:", error);
          toast({
            title: "分析失敗",
            description: error.message || "AI 分析過程中發生錯誤",
            variant: "destructive",
          });
          setIsProcessing(false);
          setStep("attendees");
        }
      );
    } catch (error: any) {
      console.error("分析請求失敗:", error);
      toast({
        title: "分析失敗",
        description: error.message || "無法啟動 AI 分析",
        variant: "destructive",
      });
      setIsProcessing(false);
      setStep("attendees");
    }
  };

  const handleComplete = () => {
    onComplete();
    resetState();
    onClose();
  };

  const renderStepContent = () => {
    switch (step) {
      case "attendees":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI 分析助手
              </DialogTitle>
              <DialogDescription>
                設定與會者資訊，讓 AI 更準確地識別說話者
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* AI 對話式提示 */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 p-3 rounded-xl bg-muted/50 text-sm">
                  請問這場會議有哪些與會者？提供名單可以讓我更準確地識別說話者。
                </div>
              </div>

              {/* 與會者名單輸入 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  與會者名單
                </Label>

                {/* 已新增的與會者 */}
                {attendees.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {attendees.map((name, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: `${speakerColors[index % speakerColors.length]}15`,
                          color: speakerColors[index % speakerColors.length],
                          border: `1px solid ${speakerColors[index % speakerColors.length]}30`,
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: speakerColors[index % speakerColors.length] }}
                        />
                        {name}
                        <button
                          onClick={() => removeAttendee(index)}
                          className="ml-1 hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* 輸入框 */}
                <div className="flex gap-2">
                  <Input
                    placeholder="輸入姓名（可用逗號分隔多人）"
                    value={newAttendee}
                    onChange={(e) => setNewAttendee(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button onClick={addAttendee} size="icon" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  支援使用逗號、頓號或換行分隔多個姓名
                </p>
              </div>

              {/* 角色定義 */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="flex-1 p-3 rounded-xl bg-muted/50 text-sm">
                    如果您能描述與會者的角色，我可以更聰明地識別誰在說話。例如：「陳經理通常是主持會議的人，林秘書負責記錄並偶爾補充。」
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">角色描述（選填）</Label>
                  <Textarea
                    placeholder="例如：陳經理是會議主持人，負責引導討論；林秘書負責記錄重點；王工程師是技術專家，會回答技術問題..."
                    value={attendeeRoles}
                    onChange={(e) => setAttendeeRoles(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full sm:w-auto"
              >
                取消
              </Button>
              <Button
                variant="ghost"
                onClick={startAnalysis}
                className="w-full sm:w-auto"
              >
                跳過，直接分析
              </Button>
              <Button
                onClick={startAnalysis}
                disabled={attendees.length === 0}
                className="w-full sm:w-auto"
              >
                開始分析
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        );

      case "processing":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                正在分析中...
              </DialogTitle>
              <DialogDescription>
                AI 正在處理您的音檔，請稍候
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 space-y-6">
              {/* 進度條 */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">分析進度</span>
                  <span className="font-semibold text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              {/* 進度訊息 */}
              <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-muted/30">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm text-foreground">{progressMessage}</span>
              </div>

              {/* 處理步驟指示 */}
              <div className="space-y-3">
                <ProcessingStep
                  label="上傳音檔至雲端"
                  isActive={progress >= 10 && progress < 40}
                  isCompleted={progress >= 40}
                />
                <ProcessingStep
                  label="多模態語者識別"
                  isActive={progress >= 40 && progress < 70}
                  isCompleted={progress >= 70}
                />
                <ProcessingStep
                  label="AI 內容分析"
                  isActive={progress >= 70 && progress < 100}
                  isCompleted={progress >= 100}
                />
              </div>
            </div>

            <DialogFooter>
              <p className="text-xs text-muted-foreground text-center w-full">
                分析時間取決於音檔長度，通常需要 1-3 分鐘
              </p>
            </DialogFooter>
          </>
        );

      case "completed":
        return (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-500">
                <Check className="w-5 h-5" />
                分析完成
              </DialogTitle>
              <DialogDescription>
                AI 已完成音檔分析，以下是分析結果摘要
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 space-y-4">
              {/* 結果摘要卡片 */}
              <div className="grid grid-cols-2 gap-3">
                <ResultCard
                  icon={<Users className="w-4 h-4" />}
                  label="識別語者"
                  value={`${completionData?.speakersCount || 0} 位`}
                  color="primary"
                />
                <ResultCard
                  icon={<MessageSquare className="w-4 h-4" />}
                  label="對話段落"
                  value={`${completionData?.segmentsCount || 0} 段`}
                  color="secondary"
                />
              </div>

              {/* 分析內容指示 */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="space-y-2">
                  <CompletedItem
                    label="會議摘要"
                    completed={completionData?.hasSummary || false}
                  />
                  <CompletedItem
                    label="待辦事項"
                    completed={completionData?.hasActionItems || false}
                  />
                  <CompletedItem label="語者識別" completed={true} />
                  <CompletedItem label="逐字稿整理" completed={true} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleComplete} className="w-full">
                查看分析結果
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}

// 處理步驟組件
function ProcessingStep({
  label,
  isActive,
  isCompleted,
}: {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {isCompleted ? (
        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        </div>
      ) : isActive ? (
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
        </div>
      )}
      <span
        className={`text-sm ${
          isCompleted
            ? "text-emerald-500 font-medium"
            : isActive
            ? "text-foreground font-medium"
            : "text-muted-foreground"
        }`}
      >
        {label}
        {isActive && "..."}
      </span>
    </div>
  );
}

// 結果卡片組件
function ResultCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "primary" | "secondary";
}) {
  const colorClasses =
    color === "primary"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-secondary/10 text-secondary border-secondary/20";

  return (
    <div className={`p-3 rounded-xl border ${colorClasses}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs opacity-70">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

// 完成項目組件
function CompletedItem({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {completed ? (
        <Check className="w-4 h-4 text-emerald-500" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground" />
      )}
      <span
        className={`text-sm ${
          completed ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
