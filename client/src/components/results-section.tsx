import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Copy, Users, Clock, FileText, TrendingUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SpeakerEditor from "@/components/speaker-editor";
import type { TranscriptionStatus, Speaker } from "@/lib/types";

interface ResultsSectionProps {
  transcription: TranscriptionStatus;
}

export default function ResultsSection({ transcription }: ResultsSectionProps) {
  const [currentTranscription, setCurrentTranscription] = useState<TranscriptionStatus>(transcription);
  const { toast } = useToast();

  const handleSpeakersUpdated = (updatedSpeakers: Speaker[]) => {
    setCurrentTranscription(prev => ({
      ...prev,
      speakers: updatedSpeakers
    }));
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyTranscript = async () => {
    if (!currentTranscription.segments) return;
    
    const fullText = currentTranscription.segments
      .map(segment => `${segment.timestamp} ${currentTranscription.speakers?.find(s => s.id === segment.speaker)?.label || '未知講者'}: ${segment.text}`)
      .join('\n');
    
    try {
      await navigator.clipboard.writeText(fullText);
      toast({
        title: "已複製到剪貼簿",
        description: "轉錄內容已成功複製",
      });
    } catch (error) {
      toast({
        title: "複製失敗",
        description: "無法複製到剪貼簿",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!currentTranscription.segments) return;
    
    const fullText = currentTranscription.segments
      .map(segment => `${segment.timestamp} ${currentTranscription.speakers?.find(s => s.id === segment.speaker)?.label || '未知講者'}: ${segment.text}`)
      .join('\n');
    
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `轉錄_${currentTranscription.originalName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="mb-8">
      {/* Results Header */}
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-success rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">轉錄完成</h3>
              <p className="text-slate-600">
                識別到 <span className="font-medium">{currentTranscription.speakers?.length || 0}</span> 位對話者
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              下載
            </Button>
            <Button variant="ghost" onClick={handleCopyTranscript}>
              <Copy className="w-4 h-4 mr-2" />
              複製
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {transcription.duration ? formatDuration(transcription.duration) : '--'}
            </div>
            <div className="text-sm text-slate-600">音頻長度</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {transcription.wordCount?.toLocaleString() || '--'}
            </div>
            <div className="text-sm text-slate-600">總字數</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <TrendingUp className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {transcription.confidence || '--'}%
            </div>
            <div className="text-sm text-slate-600">準確度</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-slate-900">
              {transcription.speakers?.length || '--'}
            </div>
            <div className="text-sm text-slate-600">對話者</div>
          </div>
        </div>

        {/* Speaker Legend */}
        {transcription.speakers && transcription.speakers.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-700 mb-3">對話者標識</h4>
            <div className="flex flex-wrap gap-3">
              {transcription.speakers.map((speaker) => (
                <div key={speaker.id} className="flex items-center space-x-2 bg-slate-50 rounded-full px-3 py-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: speaker.color }}
                  />
                  <span className="text-sm font-medium text-slate-700">{speaker.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transcript Text */}
        {transcription.segments && transcription.segments.length > 0 && (
          <div className="space-y-4" id="transcriptContent">
            {transcription.segments.map((segment, index) => {
              const speaker = transcription.speakers?.find(s => s.id === segment.speaker);
              return (
                <div key={index} className="flex space-x-4 group">
                  <div className="flex-shrink-0 text-xs text-slate-500 font-mono mt-1 w-16">
                    {segment.timestamp}
                  </div>
                  <div className="flex-shrink-0">
                    <div 
                      className="w-3 h-3 rounded-full mt-2"
                      style={{ backgroundColor: speaker?.color || '#64748B' }}
                    />
                  </div>
                  <div className="flex-1">
                    <div 
                      className="rounded-lg p-4 border-l-4"
                      style={{ 
                        backgroundColor: speaker?.color ? `${speaker.color}10` : '#F1F5F9',
                        borderLeftColor: speaker?.color || '#64748B'
                      }}
                    >
                      <div 
                        className="text-xs font-medium mb-1"
                        style={{ color: speaker?.color || '#64748B' }}
                      >
                        {speaker?.label || '未知講者'} • {segment.confidence}% 信心度
                      </div>
                      <p className="text-slate-800 leading-relaxed">{segment.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(!transcription.segments || transcription.segments.length === 0) && (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>暫無轉錄內容</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
