import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, File, X, Mic, StopCircle, Users, Code2, Calendar, Edit3, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import AudioRecorder from "./audio-recorder";
import MeetingSelector from "./meeting-selector";
import type { AnalysisMode } from "@/lib/types";
import type { CalendarEvent } from "@shared/schema";

interface UploadSectionProps {
  onFileUploaded: (transcriptionId: number) => void;
  isDisabled?: boolean;
}

interface GoogleCalendarStatus {
  configured: boolean;
  linked: boolean;
  email?: string;
}

export default function UploadSection({ onFileUploaded, isDisabled }: UploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('meeting');
  const [displayName, setDisplayName] = useState<string>('');
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarEvent | null>(null);
  const [showMeetingSelector, setShowMeetingSelector] = useState(false);
  const { toast } = useToast();

  const { data: userResponse } = useQuery<{ user: { id: number; email: string; role: string } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Fetch Google Calendar status
  const { data: calendarStatus, isLoading: isCalendarStatusLoading } = useQuery<GoogleCalendarStatus>({
    queryKey: ['/api/google/calendar/status'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/google/calendar/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
    retry: false,
  });

  const user = userResponse?.user;
  const isAdmin = user?.role === 'admin';
  const maxFileSize = isAdmin ? undefined : 500 * 1024 * 1024;
  const isCalendarLinked = calendarStatus?.configured && calendarStatus?.linked;

  // Handle meeting selection
  const handleSelectMeeting = (meeting: CalendarEvent) => {
    setSelectedMeeting(meeting);
    setDisplayName(meeting.summary || '');
  };

  // Clear meeting selection
  const handleClearMeeting = () => {
    setSelectedMeeting(null);
    setDisplayName('');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) setIsDragOver(true);
  }, [isDisabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isDisabled) return;

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file =>
      file.type.startsWith('audio/') ||
      /\.(mp3|wav|m4a|aac|flac|mp4|aiff|aif|ogg|webm|3gp|amr)$/i.test(file.name)
    );

    if (audioFile) {
      if (maxFileSize && audioFile.size > maxFileSize) {
        toast({
          title: "檔案過大",
          description: "檔案大小不能超過 500MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(audioFile);
      setActiveTab('upload');
    } else {
      toast({
        title: "不支援的格式",
        description: "請選擇音頻檔案",
        variant: "destructive",
      });
    }
  }, [isDisabled, toast, maxFileSize]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (maxFileSize && file.size > maxFileSize) {
        toast({
          title: "檔案過大",
          description: "檔案大小不能超過 500MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      console.log('[Upload] Starting file upload:', selectedFile.name, selectedFile.size, 'bytes');

      const fileSizeMB = selectedFile.size / (1024 * 1024);
      if (fileSizeMB > 100) {
        toast({
          title: "大檔案處理",
          description: `${fileSizeMB.toFixed(1)}MB，使用分段模式`,
        });
      }

      const formData = new FormData();
      formData.append('audio', selectedFile);
      formData.append('analysisMode', analysisMode);
      if (displayName.trim()) {
        formData.append('displayName', displayName.trim());
      }

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('[Upload] Auth token found');
      } else {
        console.warn('[Upload] No auth token!');
      }

      console.log('[Upload] Sending request to /api/transcriptions/upload...');
      const response = await fetch('/api/transcriptions/upload', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      console.log('[Upload] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload] Error response:', errorText);
        let errorMessage = '上傳失敗';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const transcription = await response.json();
      console.log('[Upload] Success! Transcription ID:', transcription.id);
      onFileUploaded(transcription.id);
      setSelectedFile(null);
      setDisplayName('');
      setSelectedMeeting(null);

      toast({ title: "上傳成功", description: "開始轉錄..." });
    } catch (error) {
      console.error('[Upload] Error:', error);
      toast({
        title: "上傳失敗",
        description: error instanceof Error ? error.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob, filename: string) => {
    setIsUploading(true);
    try {
      console.log('[Upload] Recording blob:', audioBlob.size, 'bytes, type:', audioBlob.type);

      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      formData.append('analysisMode', analysisMode);
      if (displayName.trim()) {
        formData.append('displayName', displayName.trim());
      }

      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn('[Upload] No auth token found');
      }

      console.log('[Upload] Sending request...');
      const response = await fetch('/api/transcriptions/upload', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });

      console.log('[Upload] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload] Error response:', errorText);
        let errorMessage = '上傳失敗';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const transcription = await response.json();
      console.log('[Upload] Success, transcription ID:', transcription.id);
      onFileUploaded(transcription.id);
      setDisplayName('');
      setSelectedMeeting(null);

      toast({ title: "錄音完成", description: "開始轉錄..." });
    } catch (error) {
      console.error('[Upload] Error:', error);
      toast({
        title: "上傳失敗",
        description: error instanceof Error ? error.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="py-4">
      {/* Tab 切換 - 更簡潔的 Segmented Control */}
      <div className="flex p-1 mb-6 bg-muted/30 rounded-xl">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'record'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>錄音</span>
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'upload'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>上傳</span>
        </button>
      </div>

      {/* 分析模式選擇 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          分析模式
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAnalysisMode('meeting')}
            disabled={isUploading}
            className={`
              flex items-center p-3 rounded-xl border-2 transition-all duration-200
              ${analysisMode === 'meeting'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/20'
              }
              ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center mr-3
              ${analysisMode === 'meeting' ? 'bg-primary/20' : 'bg-muted/50'}
            `}>
              <Users className={`w-5 h-5 ${analysisMode === 'meeting' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${analysisMode === 'meeting' ? 'text-primary' : 'text-foreground'}`}>
                會議模式
              </p>
              <p className="text-xs text-muted-foreground">
                摘要、重點、行動項目
              </p>
            </div>
          </button>
          <button
            onClick={() => setAnalysisMode('rd')}
            disabled={isUploading}
            className={`
              flex items-center p-3 rounded-xl border-2 transition-all duration-200
              ${analysisMode === 'rd'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-muted/20'
              }
              ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center mr-3
              ${analysisMode === 'rd' ? 'bg-primary/20' : 'bg-muted/50'}
            `}>
              <Code2 className={`w-5 h-5 ${analysisMode === 'rd' ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${analysisMode === 'rd' ? 'text-primary' : 'text-foreground'}`}>
                RD 模式
              </p>
              <p className="text-xs text-muted-foreground">
                技術文檔、流程圖
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 會議/記錄名稱 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          記錄名稱 <span className="text-muted-foreground font-normal">(選填)</span>
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder={isCalendarLinked ? "輸入名稱或選擇會議" : "輸入記錄名稱..."}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (selectedMeeting && e.target.value !== selectedMeeting.summary) {
                  setSelectedMeeting(null);
                }
              }}
              disabled={isUploading}
              className="h-11 pr-10"
            />
            {displayName && (
              <button
                type="button"
                onClick={handleClearMeeting}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {isCalendarLinked && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMeetingSelector(true)}
              disabled={isUploading}
              className="h-11 px-4 shrink-0"
            >
              <Calendar className="w-4 h-4 mr-2" />
              選擇會議
            </Button>
          )}
        </div>
        {selectedMeeting && (
          <p className="mt-2 text-xs text-muted-foreground flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            已選擇: {selectedMeeting.summary}
          </p>
        )}
        {!isCalendarLinked && calendarStatus?.configured && (
          <p className="mt-2 text-xs text-muted-foreground">
            前往「帳戶」頁面綁定 Google Calendar 即可選擇會議
          </p>
        )}
      </div>

      {/* 會議選擇器 Dialog */}
      <MeetingSelector
        open={showMeetingSelector}
        onOpenChange={setShowMeetingSelector}
        onSelectMeeting={handleSelectMeeting}
      />

      {/* 錄音區 */}
      {activeTab === 'record' && (
        <div className="space-y-4">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            isDisabled={isDisabled || isUploading}
          />
        </div>
      )}

      {/* 上傳區 */}
      {activeTab === 'upload' && (
        <div className="space-y-4">
          {/* 拖放區域 - 更簡潔 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isDisabled && document.getElementById('audioFile')?.click()}
            className={`
              relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200
              ${isDragOver
                ? 'border-primary bg-primary/5'
                : 'border-border/60 hover:border-primary/50 hover:bg-muted/20'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex flex-col items-center">
              <div className={`
                w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-200
                ${isDragOver ? 'bg-primary/20' : 'bg-muted/50'}
              `}>
                <Upload className={`w-6 h-6 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <p className="text-sm text-foreground font-medium mb-1">
                拖放檔案或點擊選擇
              </p>
              <p className="text-xs text-muted-foreground">
                MP3, WAV, M4A 等格式
                {!isAdmin && <span className="ml-1">· 最大 500MB</span>}
              </p>
            </div>

            <input
              type="file"
              id="audioFile"
              accept=".mp3,.wav,.m4a,.aac,.flac,.mp4,.aiff,.aif,.ogg,.webm,.3gp,.amr"
              className="hidden"
              onChange={handleFileInputChange}
              disabled={isDisabled}
            />
          </div>

          {/* 已選檔案預覽 */}
          {selectedFile && (
            <div className="flex items-center p-4 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mr-3">
                <File className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                disabled={isUploading}
                className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 上傳按鈕 */}
          {selectedFile && (
            <Button
              onClick={handleUpload}
              disabled={isUploading || isDisabled}
              className="w-full h-12 rounded-xl text-base font-medium"
              variant="default"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  上傳中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  開始轉錄
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
