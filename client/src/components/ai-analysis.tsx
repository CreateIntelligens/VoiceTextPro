import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Check if we already have AI analysis data in the transcription
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
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">AI 智能分析</CardTitle>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              Powered by Gemini
            </Badge>
          </div>
          {!analysis && (
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  開始分析
                </>
              )}
            </Button>
          )}
        </div>
        {hasExistingAnalysis && (
          <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
            已完成AI語意分析，30個對話段落已處理
          </div>
        )}
      </CardHeader>

      {(analysis || hasExistingAnalysis) && (
        <CardContent className="space-y-6">
          {/* Summary */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Lightbulb className="w-4 h-4 text-purple-600" />
              <h4 className="font-semibold text-slate-900">會議摘要</h4>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {analysis?.summary || (hasExistingAnalysis ? transcription.summary || "AI語意分析已完成，轉錄內容已分段並優化為更清晰的對話結構。" : "")}
            </p>
          </div>

          {/* Key Points */}
          {analysis?.keyPoints && analysis.keyPoints.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Hash className="w-4 h-4 text-blue-600" />
                <h4 className="font-semibold text-slate-900">重要要點</h4>
                <Badge variant="outline">{analysis?.keyPoints?.length || 0} 項</Badge>
              </div>
              <ul className="space-y-2">
                {analysis?.keyPoints?.map((point, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-slate-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Speaker Insights */}
          {analysis?.speakerInsights && analysis.speakerInsights.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Users className="w-4 h-4 text-green-600" />
                <h4 className="font-semibold text-slate-900">對話者分析</h4>
              </div>
              <div className="space-y-3">
                {analysis?.speakerInsights?.map((insight, index) => (
                  <div key={index} className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className="bg-white">
                        {insight.speaker}
                      </Badge>
                      <span className="text-sm font-medium text-green-700">
                        {insight.role}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm">{insight.contribution}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {analysis?.actionItems && analysis.actionItems.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <CheckSquare className="w-4 h-4 text-orange-600" />
                <h4 className="font-semibold text-slate-900">行動項目</h4>
                <Badge variant="outline">{analysis?.actionItems?.length || 0} 項</Badge>
              </div>
              <ul className="space-y-2">
                {analysis?.actionItems?.map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                    <div className="w-4 h-4 border-2 border-orange-500 rounded mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Topics */}
          {analysis?.topics && analysis.topics.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Hash className="w-4 h-4 text-indigo-600" />
                <h4 className="font-semibold text-slate-900">討論主題</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis?.topics?.map((topic, index) => (
                  <Badge key={index} variant="secondary" className="bg-indigo-100 text-indigo-700">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  重新分析中...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  重新分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}

      {!analysis && !isAnalyzing && (
        <CardContent>
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">
              使用 Gemini AI 分析對話內容，提供智能洞察和重點摘要
            </p>
            <p className="text-xs text-slate-400">
              • 會議摘要和重點分析<br />
              • 對話者角色識別<br />
              • 行動項目提取<br />
              • 主題標籤生成
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}