import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, RefreshCw, Check, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus } from "@/lib/types";

interface CleanedResult {
  cleanedText: string;
  improvements: string[];
}

interface TranscriptCleanerProps {
  transcription: TranscriptionStatus;
  onTranscriptCleaned: (cleanedText: string) => void;
}

export default function TranscriptCleaner({ transcription, onTranscriptCleaned }: TranscriptCleanerProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [cleanedResult, setCleanedResult] = useState<CleanedResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const { toast } = useToast();

  const handleCleanTranscript = async () => {
    setIsCleaning(true);
    
    try {
      const response = await fetch(`/api/transcriptions/${transcription.id}/clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '逐字稿整理失敗');
      }

      const result = await response.json();
      setCleanedResult(result);
      setShowComparison(true);
      
      toast({
        title: "逐字稿整理完成",
        description: "AI 已完成文字整理和優化",
      });
    } catch (error) {
      console.error('Cleaning error:', error);
      toast({
        title: "整理失敗",
        description: error instanceof Error ? error.message : "逐字稿整理過程中發生錯誤",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleApplyCleanedVersion = async () => {
    if (!cleanedResult) return;

    setIsApplying(true);
    
    try {
      // 使用 AI 語意分析將整理後文字智能分配給不同講者
      const response = await fetch(`/api/transcriptions/${transcription.id}/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cleanedText: cleanedResult.cleanedText
        })
      });

      if (!response.ok) throw new Error('AI 語意分段失敗');

      onTranscriptCleaned(cleanedResult.cleanedText);
      setShowComparison(false);
      
      toast({
        title: "逐字稿已更新",
        description: "AI 已智能分配整理後文字給各講者",
      });
    } catch (error) {
      toast({
        title: "更新失敗",
        description: "AI 語意分段處理失敗，請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
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
            <Wand2 className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg">AI 逐字稿整理</CardTitle>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
              文字優化
            </Badge>
          </div>
          {!cleanedResult && (
            <Button
              onClick={handleCleanTranscript}
              disabled={isCleaning}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  整理中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  開始整理
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      {cleanedResult && showComparison && (
        <CardContent className="space-y-6">
          {/* Improvements Summary */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Check className="w-4 h-4 text-indigo-600" />
              <h4 className="font-semibold text-slate-900">整理完成</h4>
            </div>
            <div className="space-y-2">
              {cleanedResult.improvements.map((improvement, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{improvement}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Text Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-gray-600" />
                原始逐字稿
              </h4>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto border">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {transcription.transcriptText}
                </p>
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center">
                原始字數: {transcription.transcriptText?.length || 0} 字元
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
                <Wand2 className="w-4 h-4 mr-2 text-indigo-600" />
                整理後逐字稿
              </h4>
              <div className="bg-indigo-50 rounded-lg p-4 max-h-96 overflow-y-auto border border-indigo-200">
                <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
                  {cleanedResult.cleanedText}
                </p>
              </div>
              <div className="mt-2 text-xs text-indigo-600 text-center">
                整理後字數: {cleanedResult.cleanedText.length} 字元
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setShowComparison(false)}
            >
              取消
            </Button>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={handleCleanTranscript}
                disabled={isCleaning}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重新整理
              </Button>
              <Button
                onClick={handleApplyCleanedVersion}
                disabled={isApplying}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    AI 語意分段中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    套用整理結果
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      {!cleanedResult && !isCleaning && (
        <CardContent>
          <div className="text-center py-8">
            <Wand2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">
              使用 AI 智能整理逐字稿，提升文字的流暢度和可讀性
            </p>
            <p className="text-xs text-slate-400">
              • 修正破碎和不完整的語句<br />
              • 改善標點符號和語法<br />
              • 保持原意不變的前提下優化表達<br />
              • 統一語言風格和用詞
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}