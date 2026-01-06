import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, Lightbulb, Users, CheckSquare, Hash, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus } from "@/lib/types";

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  speakerInsights: Array<{
    speaker: string;
    role: string;
    contribution: string;
  }>;
  actionItems: string[];
  topics: string[];
}

interface AIAnalysisProps {
  transcription: TranscriptionStatus;
}

export default function AIAnalysis({ transcription }: AIAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const hasExistingAnalysis = transcription.segments && transcription.segments.length > 0 &&
    transcription.summaryType !== 'basic';

  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/transcriptions/${transcription.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'AI 分析失敗');
      }

      const result = await response.json();
      setAnalysis(result);

      toast({
        title: "AI 分析完成",
        description: "Gemini AI 已完成對話內容分析",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "分析失敗",
        description: error instanceof Error ? error.message : "AI 分析過程中發生錯誤",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (transcription.status !== 'completed') {
    return null;
  }

  return (
    <div className="rounded-xl bg-card/50 border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-foreground">AI 智能分析</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-secondary/10 text-secondary">
              Gemini
            </span>
          </div>
          {!analysis && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              size="sm"
              className="h-8 rounded-lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  開始分析
                </>
              )}
            </Button>
          )}
        </div>
        {hasExistingAnalysis && (
          <p className="text-xs text-emerald-500 mt-2">
            已完成 AI 語意分析，30 個對話段落已處理
          </p>
        )}
      </div>

      {/* Content */}
      {(analysis || hasExistingAnalysis) ? (
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="p-3 rounded-xl bg-secondary/5 border border-secondary/20">
            <div className="flex items-center space-x-2 mb-2">
              <Lightbulb className="w-3.5 h-3.5 text-secondary" />
              <span className="text-xs font-medium text-secondary">會議摘要</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {analysis?.summary || (hasExistingAnalysis ? transcription.summary || "AI 語意分析已完成，轉錄內容已分段並優化為更清晰的對話結構。" : "")}
            </p>
          </div>

          {/* Key Points */}
          {analysis?.keyPoints && analysis.keyPoints.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">重要要點</span>
                <span className="text-[10px] text-muted-foreground">{analysis.keyPoints.length} 項</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Speaker Insights */}
          {analysis?.speakerInsights && analysis.speakerInsights.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-medium text-foreground">對話者分析</span>
              </div>
              <div className="space-y-2">
                {analysis.speakerInsights.map((insight, index) => (
                  <div key={index} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium text-emerald-500">{insight.speaker}</span>
                      <span className="text-[10px] text-muted-foreground">· {insight.role}</span>
                    </div>
                    <p className="text-xs text-foreground">{insight.contribution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {analysis?.actionItems && analysis.actionItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-foreground">行動項目</span>
                <span className="text-[10px] text-muted-foreground">{analysis.actionItems.length} 項</span>
              </div>
              <ul className="space-y-1.5">
                {analysis.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-3.5 h-3.5 border border-amber-500 rounded mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Topics */}
          {analysis?.topics && analysis.topics.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">討論主題</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.topics.map((topic, index) => (
                  <span key={index} className="px-2 py-0.5 rounded-lg text-xs bg-primary/10 text-primary border border-primary/20">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Re-analyze Button */}
          <div className="pt-3 border-t border-border/50">
            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full h-9 rounded-lg"
              size="sm"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  重新分析中...
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5 mr-1.5" />
                  重新分析
                </>
              )}
            </Button>
          </div>
        </div>
      ) : !isAnalyzing ? (
        <div className="p-8 text-center">
          <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            使用 Gemini AI 分析對話內容
          </p>
          <p className="text-xs text-muted-foreground/70">
            會議摘要 · 重點分析 · 行動項目 · 主題標籤
          </p>
        </div>
      ) : null}
    </div>
  );
}
