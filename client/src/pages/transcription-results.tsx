import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Copy, Users, Clock, FileText, TrendingUp, History, ArrowLeft, Music, FileDown, Brain, Sparkles, MessageSquare, Target, Lightbulb, BarChart3, Edit2, Check, X, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { TranscriptionStatus } from "@/lib/types";
import { Link } from "wouter";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function TranscriptionResultsPage() {
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<number | null>(null);
  const [speakerEditValue, setSpeakerEditValue] = useState("");
  const { toast } = useToast();

  // Query for all transcriptions - no automatic polling to prevent infinite API calls
  const { data: transcriptions = [], refetch } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
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

  const handleAIAnalysis = async (transcriptionId: number) => {
    setIsAnalyzing(true);
    try {
      const result = await apiRequest(`/api/transcriptions/${transcriptionId}/ai-analysis`, 'POST');
      
      // Refresh the transcription data to show new analysis
      refetch();
      
      toast({
        title: "AI分析完成",
        description: "智能內容分析已完成，請查看分析結果",
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "AI分析失敗",
        description: "無法完成智能內容分析，請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAICleanup = async (transcriptionId: number) => {
    setIsCleaning(true);
    try {
      const result = await apiRequest(`/api/transcriptions/${transcriptionId}/ai-cleanup`, 'POST');
      
      // Refresh the transcription data to show cleaned content
      refetch();
      
      toast({
        title: "逐字稿整理完成",
        description: "AI已成功整理並優化逐字稿內容",
      });
    } catch (error) {
      console.error('AI cleanup error:', error);
      toast({
        title: "逐字稿整理失敗",
        description: "無法完成逐字稿整理，請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSpeakerEdit = (index: number, currentName: string) => {
    setEditingSpeaker(index);
    setSpeakerEditValue(currentName);
  };

  const handleSpeakerSave = async (transcriptionId: number) => {
    if (editingSpeaker === null || !selectedTranscription) return;
    
    try {
      const updatedSpeakers = [...(selectedTranscription.speakers as unknown as string[] || [])];
      updatedSpeakers[editingSpeaker] = speakerEditValue;

      await apiRequest(`/api/transcriptions/${transcriptionId}/speakers`, 'PATCH', {
        speakers: updatedSpeakers
      });

      // Refresh the transcription data
      refetch();
      setEditingSpeaker(null);
      setSpeakerEditValue("");
      
      toast({
        title: "講者標籤已更新",
        description: "講者名稱已成功修改",
      });
    } catch (error) {
      console.error('Speaker update error:', error);
      toast({
        title: "更新失敗",
        description: "無法更新講者標籤，請稍後再試",
        variant: "destructive",
      });
    }
  };

  const handleSpeakerCancel = () => {
    setEditingSpeaker(null);
    setSpeakerEditValue("");
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refetch();
                }}
              >
                手動刷新
              </Button>
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
                        <Button 
                          variant="outline" 
                          onClick={() => handleAIAnalysis(selectedTranscription.id)}
                          disabled={isAnalyzing}
                          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700"
                        >
                          {isAnalyzing ? (
                            <>
                              <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                              分析中...
                            </>
                          ) : (
                            <>
                              <Brain className="w-4 h-4 mr-2" />
                              AI 智能分析
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleAICleanup(selectedTranscription.id)}
                          disabled={isCleaning}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 hover:from-green-600 hover:to-emerald-700"
                        >
                          {isCleaning ? (
                            <>
                              <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                              整理中...
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-4 h-4 mr-2" />
                              AI 整理逐字稿
                            </>
                          )}
                        </Button>
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
                          {(selectedTranscription.speakers || []).map((speaker, index) => {
                            const speakerName = typeof speaker === 'string' ? speaker : (speaker as any).name || (speaker as any).id || `講者 ${index + 1}`;
                            const speakerColor = typeof speaker === 'string' 
                              ? ['#2563eb', '#dc2626', '#059669', '#7c2d12', '#4338ca', '#be185d'][index % 6]
                              : speaker.color || '#2563eb';
                            
                            if (editingSpeaker === index) {
                              return (
                                <div key={`speaker-${index}-${speakerName}`} className="flex items-center space-x-2 bg-slate-50 rounded-full px-3 py-1">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: speakerColor }}
                                  />
                                  <Input
                                    value={speakerEditValue}
                                    onChange={(e) => setSpeakerEditValue(e.target.value)}
                                    className="w-20 h-6 text-xs px-2 py-1"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSpeakerSave(selectedTranscription.id);
                                      } else if (e.key === 'Escape') {
                                        handleSpeakerCancel();
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <div className="flex items-center space-x-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleSpeakerSave(selectedTranscription.id)}
                                    >
                                      <Check className="h-3 w-3 text-green-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={handleSpeakerCancel}
                                    >
                                      <X className="h-3 w-3 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div key={`speaker-${index}-${speakerName}`} className="flex items-center space-x-2 bg-slate-50 rounded-full px-3 py-1 group hover:bg-slate-100">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: speakerColor }}
                                />
                                <span className="text-sm font-medium text-slate-700">{speakerName}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleSpeakerEdit(index, speakerName)}
                                >
                                  <Edit2 className="h-3 w-3 text-slate-400" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Full Transcript Text */}
                    {selectedTranscription.transcriptText && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">完整轉錄內容</h4>
                        <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                          <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {selectedTranscription.transcriptText}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Transcript Text */}
                    {selectedTranscription.segments && selectedTranscription.segments.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-700 mb-3">分段對話內容</h4>
                        {selectedTranscription.segments.map((segment, index) => {
                          const colors = ['#2563eb', '#dc2626', '#059669', '#7c2d12', '#4338ca', '#be185d'];
                          
                          // Handle both old and new speaker data structures
                          let speakerColor = colors[0];
                          let speakerName = segment.speaker || '未知講者';
                          
                          if (selectedTranscription.speakers) {
                            const speakers = selectedTranscription.speakers;
                            if (typeof speakers[0] === 'string') {
                              // Old format: array of strings
                              const speakerIndex = speakers.indexOf(segment.speaker);
                              speakerColor = colors[speakerIndex >= 0 ? speakerIndex : 0];
                            } else {
                              // New format: array of objects
                              const speakerObj = speakers.find(s => s.id === segment.speaker);
                              if (speakerObj) {
                                speakerColor = speakerObj.color || colors[0];
                                speakerName = speakerObj.name || segment.speaker || '未知講者';
                              }
                            }
                          }
                          
                          return (
                            <div key={`segment-${index}-${segment.start}-${segment.end}`} className="flex space-x-4 group">
                              <div className="flex-shrink-0 text-xs text-slate-500 font-mono mt-1 w-16">
                                {segment.startTime || (segment.start ? `${Math.floor(segment.start/60000)}:${Math.floor((segment.start%60000)/1000).toString().padStart(2,'0')}` : '00:00')}
                              </div>
                              <div className="flex-shrink-0">
                                <div 
                                  className="w-3 h-3 rounded-full mt-2"
                                  style={{ backgroundColor: speakerColor }}
                                />
                              </div>
                              <div className="flex-1">
                                <div 
                                  className="rounded-lg p-4 border-l-4"
                                  style={{ 
                                    backgroundColor: `${speakerColor}10`,
                                    borderLeftColor: speakerColor
                                  }}
                                >
                                  <div 
                                    className="text-xs font-medium mb-1"
                                    style={{ color: speakerColor }}
                                  >
                                    {speakerName} • {Math.round((segment.confidence || 0) * 100)}% 信心度
                                  </div>
                                  <p className="text-slate-800 leading-relaxed">{segment.text}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* AI Analysis Results */}
                    {(selectedTranscription.summary || selectedTranscription.topicsDetection || selectedTranscription.autoHighlights) && (
                      <div className="mt-8 space-y-6">
                        <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                          <Brain className="w-5 h-5 mr-2 text-blue-600" />
                          AI 智能分析結果
                        </h4>

                        {/* Summary */}
                        {selectedTranscription.summary && (
                          <Card className="border-blue-100">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center text-blue-700">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                內容摘要
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <p className="text-slate-700 leading-relaxed">{selectedTranscription.summary}</p>
                            </CardContent>
                          </Card>
                        )}

                        {/* Key Topics */}
                        {selectedTranscription.topicsDetection && (
                          <Card className="border-green-100">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center text-green-700">
                                <Target className="w-4 h-4 mr-2" />
                                關鍵主題
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-2">
                                {Array.isArray(selectedTranscription.topicsDetection) && 
                                  selectedTranscription.topicsDetection.map((topic: any, index: number) => (
                                    <Badge key={index} variant="secondary" className="bg-green-50 text-green-700">
                                      {typeof topic === 'string' ? topic : topic.topic || topic.label}
                                    </Badge>
                                  ))
                                }
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Speaker Analysis */}
                        {selectedTranscription.entityDetection?.speakerAnalysis && (
                          <Card className="border-indigo-100">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center text-indigo-700">
                                <Users className="w-4 h-4 mr-2" />
                                講者分析
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-4">
                                {typeof selectedTranscription.entityDetection.speakerAnalysis === 'object' && 
                                  Object.entries(selectedTranscription.entityDetection.speakerAnalysis).map(([speaker, analysis]: [string, any]) => (
                                    <div key={speaker} className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
                                      <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-medium text-indigo-900">{speaker}</h5>
                                        {analysis.participationRate && (
                                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                                            參與度: {analysis.participationRate}
                                          </span>
                                        )}
                                      </div>
                                      <div className="space-y-2 text-sm text-slate-700">
                                        {analysis.characteristics && (
                                          <p><strong>發言特點:</strong> {analysis.characteristics}</p>
                                        )}
                                        {analysis.mainPoints && (
                                          <p><strong>主要觀點:</strong> {analysis.mainPoints}</p>
                                        )}
                                        {analysis.role && (
                                          <p><strong>角色定位:</strong> {analysis.role}</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Auto Highlights */}
                        {selectedTranscription.autoHighlights && (
                          <Card className="border-yellow-100">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm flex items-center text-yellow-700">
                                <Lightbulb className="w-4 h-4 mr-2" />
                                重點摘錄
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2">
                                {Array.isArray(selectedTranscription.autoHighlights) &&
                                  selectedTranscription.autoHighlights.map((highlight: any, index: number) => (
                                    <div key={index} className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                                      <p className="text-slate-700">
                                        {typeof highlight === 'string' ? highlight : highlight.text || highlight.content}
                                      </p>
                                    </div>
                                  ))
                                }
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    {(!selectedTranscription.segments || selectedTranscription.segments.length === 0) && !selectedTranscription.transcriptText && (
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