import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Copy, Users, Clock, FileText, TrendingUp, History, ArrowLeft, Music, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus } from "@/lib/types";
import { Link } from "wouter";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

export default function TranscriptionResultsPage() {
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState<number | null>(null);
  const { toast } = useToast();

  // Query for all transcriptions
  const { data: transcriptions = [] } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
    refetchInterval: 5000,
  });

  // Query for selected transcription details
  const { data: selectedTranscription } = useQuery<TranscriptionStatus>({
    queryKey: [`/api/transcriptions/${selectedTranscriptionId}`],
    enabled: !!selectedTranscriptionId,
  });

  // Auto-select the first completed transcription
  useEffect(() => {
    if (!selectedTranscriptionId && transcriptions.length > 0) {
      const completed = transcriptions.find(t => t.status === 'completed');
      if (completed) {
        setSelectedTranscriptionId(completed.id);
      }
    }
  }, [transcriptions, selectedTranscriptionId]);

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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopyTranscript = async (transcription: TranscriptionStatus) => {
    if (!transcription.segments) return;
    
    const fullText = transcription.segments
      .map(segment => `${segment.timestamp} ${transcription.speakers?.find(s => s.id === segment.speaker)?.label || '未知講者'}: ${segment.text}`)
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

  const handleDownloadText = (transcription: TranscriptionStatus) => {
    if (!transcription.segments) return;
    
    const fullText = transcription.segments
      .map(segment => `${segment.timestamp} ${transcription.speakers?.find(s => s.id === segment.speaker)?.label || '未知講者'}: ${segment.text}`)
      .join('\n');
    
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

  const handleDownloadWord = async (transcription: TranscriptionStatus) => {
    if (!transcription.segments) return;
    
    try {
      // Create document header
      const children = [
        new Paragraph({
          text: "語音轉錄報告",
          heading: HeadingLevel.TITLE,
        }),
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
        new Paragraph({
          children: [
            new TextRun({ text: "音頻時長: ", bold: true }),
            new TextRun({ text: transcription.duration ? formatDuration(transcription.duration) : "未知" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "準確度: ", bold: true }),
            new TextRun({ text: transcription.confidence ? `${(transcription.confidence * 100).toFixed(1)}%` : "未知" }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "字數統計: ", bold: true }),
            new TextRun({ text: transcription.wordCount ? `${transcription.wordCount} 字` : "未統計" }),
          ],
        }),
        new Paragraph({ text: "" }), // Empty line
        new Paragraph({
          text: "轉錄內容",
          heading: HeadingLevel.HEADING_1,
        }),
      ];

      // Add transcription segments
      transcription.segments.forEach((segment, index) => {
        const speakerLabel = transcription.speakers?.find(s => s.id === segment.speaker)?.label || '未知講者';
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `[${segment.timestamp}] `, color: "666666" }),
              new TextRun({ text: `${speakerLabel}: `, bold: true }),
              new TextRun({ text: segment.text }),
            ],
            spacing: { after: 200 },
          })
        );
      });

      // Add summary if available
      if (transcription.summary) {
        children.push(
          new Paragraph({ text: "" }), // Empty line
          new Paragraph({
            text: "AI 摘要",
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: transcription.summary,
            spacing: { after: 200 },
          })
        );
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `轉錄_${transcription.originalName || transcription.filename}.docx`);
      
      toast({
        title: "Word文檔已下載",
        description: "轉錄內容已成功導出為Word文檔",
      });
    } catch (error) {
      console.error('Word export error:', error);
      toast({
        title: "導出失敗",
        description: "無法生成Word文檔",
        variant: "destructive",
      });
    }
  };

  const handleDownloadAudio = async (transcription: TranscriptionStatus) => {
    try {
      const response = await fetch(`/api/transcriptions/${transcription.id}/download-audio`);
      
      if (!response.ok) {
        throw new Error('下載失敗');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = transcription.originalName || transcription.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "音頻檔案已下載",
        description: "原始音頻檔案下載完成",
      });
    } catch (error) {
      console.error('Audio download error:', error);
      toast({
        title: "下載失敗",
        description: "無法下載音頻檔案",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'processing': return '處理中';
      case 'error': return '錯誤';
      case 'pending': return '等待中';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回上傳
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-slate-600" />
                <h1 className="text-xl font-semibold text-slate-900">轉錄記錄</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">共 {transcriptions.length} 筆記錄</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Left Sidebar - Transcription History */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card>
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg">轉錄記錄</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1 max-h-80 sm:max-h-96 overflow-y-auto">
                  {transcriptions.length === 0 ? (
                    <div className="p-4 text-center text-slate-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">暫無轉錄記錄</p>
                    </div>
                  ) : (
                    transcriptions.map((transcription) => (
                      <div
                        key={transcription.id}
                        className={`p-3 cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          selectedTranscriptionId === transcription.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => setSelectedTranscriptionId(transcription.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {transcription.originalName || transcription.filename}
                          </span>
                          <Badge variant="secondary" className={`text-xs ${getStatusColor(transcription.status)}`}>
                            {getStatusText(transcription.status)}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <div>{formatDate(transcription.createdAt)}</div>
                          {transcription.status === 'completed' && (
                            <div className="flex items-center space-x-2">
                              <span>{transcription.speakers?.length || 0} 位講者</span>
                              <span>•</span>
                              <span>{transcription.duration ? formatDuration(transcription.duration) : '--'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Content - Transcription Details */}
          <div className="lg:col-span-3">
            {selectedTranscription ? (
              selectedTranscription.status === 'completed' ? (
                <Card>
                  {/* Results Header */}
                  <div className="border-b border-slate-200 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {selectedTranscription.originalName || selectedTranscription.filename}
                          </h3>
                          <p className="text-slate-600">
                            識別到 <span className="font-medium">{selectedTranscription.speakers?.length || 0}</span> 位對話者
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" onClick={() => handleDownloadAudio(selectedTranscription)}>
                          <Music className="w-4 h-4 mr-2" />
                          音頻檔案
                        </Button>
                        <Button variant="ghost" onClick={() => handleDownloadWord(selectedTranscription)}>
                          <FileDown className="w-4 h-4 mr-2" />
                          Word文檔
                        </Button>
                        <Button variant="ghost" onClick={() => handleDownloadText(selectedTranscription)}>
                          <Download className="w-4 h-4 mr-2" />
                          文字檔案
                        </Button>
                        <Button variant="ghost" onClick={() => handleCopyTranscript(selectedTranscription)}>
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
                          {selectedTranscription.duration ? formatDuration(selectedTranscription.duration) : '--'}
                        </div>
                        <div className="text-sm text-slate-600">音頻長度</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <FileText className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-slate-900">
                          {selectedTranscription.wordCount?.toLocaleString() || '--'}
                        </div>
                        <div className="text-sm text-slate-600">總字數</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <TrendingUp className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-slate-900">
                          {selectedTranscription.confidence ? Math.round(selectedTranscription.confidence * 100) : '--'}%
                        </div>
                        <div className="text-sm text-slate-600">準確度</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-slate-900">
                          {selectedTranscription.speakers?.length || '--'}
                        </div>
                        <div className="text-sm text-slate-600">對話者</div>
                      </div>
                    </div>

                    {/* Speaker Legend */}
                    {selectedTranscription.speakers && selectedTranscription.speakers.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">對話者標識</h4>
                        <div className="flex flex-wrap gap-3">
                          {selectedTranscription.speakers.map((speaker) => (
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
                    {selectedTranscription.segments && selectedTranscription.segments.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">轉錄內容</h4>
                        {selectedTranscription.segments.map((segment, index) => {
                          const speaker = selectedTranscription.speakers?.find(s => s.id === segment.speaker);
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
                                    {speaker?.label || '未知講者'} • {Math.round((segment.confidence || 0) * 100)}% 信心度
                                  </div>
                                  <p className="text-slate-800 leading-relaxed">{segment.text}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {(!selectedTranscription.segments || selectedTranscription.segments.length === 0) && (
                      <div className="text-center py-8 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p>暫無轉錄內容</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="text-slate-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p className="text-lg mb-2">轉錄尚未完成</p>
                      <p className="text-sm">
                        狀態：{getStatusText(selectedTranscription.status)}
                        {selectedTranscription.status === 'processing' && ` (${selectedTranscription.progress || 0}%)`}
                      </p>
                      {selectedTranscription.errorMessage && (
                        <p className="text-red-600 text-sm mt-2">{selectedTranscription.errorMessage}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-lg mb-2">選擇一個轉錄記錄</p>
                    <p className="text-sm">從左側選單選擇一個轉錄記錄來查看詳細內容</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}