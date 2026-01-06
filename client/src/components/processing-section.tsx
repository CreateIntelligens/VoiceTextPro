import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Circle, X, AudioWaveform } from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface ProcessingSectionProps {
  transcription: TranscriptionStatus;
  onCancel?: (id: number) => void;
}

export default function ProcessingSection({ transcription, onCancel }: ProcessingSectionProps) {
  const progress = transcription.progress || 0;

  const steps = [
    { label: "音頻檔案上傳完成", completed: progress >= 10 },
    { label: "正在進行語音識別", completed: progress >= 50, current: progress >= 10 && progress < 50 },
    { label: "識別對話者", completed: progress >= 80, current: progress >= 50 && progress < 80 },
    { label: "轉錄完成", completed: progress >= 100, current: progress >= 80 && progress < 100 },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Animated Icon */}
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <AudioWaveform className="w-6 h-6 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">
                正在處理音頻
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                AI 智能語音模型轉錄中...
              </p>
            </div>
          </div>

          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancel(transcription.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 px-3"
            >
              <X className="w-4 h-4 mr-1.5" />
              取消轉錄
            </Button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="p-5">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-foreground">轉錄進度</span>
            <span className="text-sm font-semibold text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              {/* Step Icon */}
              {step.completed ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
              ) : step.current ? (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <Circle className="w-3 h-3 text-muted-foreground" />
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
  );
}
