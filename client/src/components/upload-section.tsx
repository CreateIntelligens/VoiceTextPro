import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, File, X, CloudUpload, Tag, Save, RotateCcw, Info, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AudioRecorder from "./audio-recorder";
import { KeywordInput } from "./keyword-input";

interface UploadSectionProps {
  onFileUploaded: (transcriptionId: number) => void;
  isDisabled?: boolean;
}

export default function UploadSection({ onFileUploaded, isDisabled }: UploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [keywords, setKeywords] = useState<string>("");
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      setIsDragOver(true);
    }
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
      if (audioFile.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: "檔案過大",
          description: "檔案大小不能超過 100MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(audioFile);
    } else {
      toast({
        title: "不支援的檔案格式",
        description: "請選擇音頻檔案（MP3、WAV、M4A 等）",
        variant: "destructive",
      });
    }
  }, [isDisabled, toast]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: "檔案過大",
          description: "檔案大小不能超過 100MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSaveKeywords = () => {
    const trimmedKeywords = keywords.trim();
    localStorage.setItem('transcription-keywords', trimmedKeywords);
    setSavedKeywords(trimmedKeywords);
    toast({
      title: "關鍵字已儲存",
      description: "下次使用時會自動載入這些關鍵字",
    });
  };

  const handleResetKeywords = () => {
    setKeywords("");
    localStorage.removeItem('transcription-keywords');
    setSavedKeywords("");
    toast({
      title: "關鍵字已清除",
      description: "已移除所有儲存的關鍵字",
    });
  };

  const handleLoadSavedKeywords = () => {
    setKeywords(savedKeywords);
  };

  const validateKeywords = (keywordString: string): string[] => {
    if (!keywordString.trim()) return [];
    
    const keywords = keywordString
      .split(/[,，\n\r]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .filter(k => /^[a-zA-Z0-9\s\-_]+$/.test(k)); // Only allow English alphanumeric and basic symbols
    
    return Array.from(new Set(keywords)); // Remove duplicates
  };

  const getKeywordCount = (): number => {
    return validateKeywords(keywords).length;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      
      const validKeywords = validateKeywords(keywords);
      if (validKeywords.length > 0) {
        formData.append('keywords', validKeywords.join(','));
      }

      const response = await fetch('/api/transcriptions/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '檔案上傳失敗');
      }

      const transcription = await response.json();
      onFileUploaded(transcription.id);
      
      toast({
        title: "檔案上傳成功",
        description: validKeywords.length > 0 
          ? `正在開始轉錄程序，已應用 ${validKeywords.length} 個關鍵字...`
          : "正在開始轉錄程序...",
      });
    } catch (error) {
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
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      
      const validKeywords = validateKeywords(keywords);
      if (validKeywords.length > 0) {
        formData.append('keywords', validKeywords.join(','));
      }

      const response = await fetch('/api/transcriptions/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '錄音上傳失敗');
      }

      const transcription = await response.json();
      onFileUploaded(transcription.id);
      
      toast({
        title: "錄音上傳成功",
        description: validKeywords.length > 0 
          ? `正在開始轉錄程序，已應用 ${validKeywords.length} 個關鍵字...`
          : "正在開始轉錄程序...",
      });
    } catch (error) {
      toast({
        title: "錄音上傳失敗",
        description: error instanceof Error ? error.message : "未知錯誤",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mb-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">音頻轉錄</h2>
        <p className="text-sm sm:text-base text-slate-600">即時錄音或上傳音檔，獲得高品質的繁體中文語音轉錄</p>
      </div>

      <Tabs defaultValue="record" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="record" className="flex items-center space-x-2">
            <Mic className="w-4 h-4" />
            <span>即時錄音</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>上傳檔案</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-4">
          <AudioRecorder 
            onRecordingComplete={handleRecordingComplete}
            isDisabled={isDisabled || isUploading}
          />
        </TabsContent>

        <TabsContent value="upload" className="space-y-4">
          <Card 
            className={`border-2 border-dashed transition-colors duration-200 cursor-pointer ${
              isDragOver 
                ? 'border-primary bg-blue-50' 
                : 'border-slate-300 hover:border-primary'
            } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="mb-4">
                <CloudUpload className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400 mx-auto mb-4" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-2">拖拽檔案至此處或點擊上傳</h3>
              <p className="text-sm sm:text-base text-slate-600 mb-4">支援 MP3、WAV、M4A 等格式，最大檔案大小：100MB</p>
              <Button 
                onClick={() => !isDisabled && document.getElementById('audioFile')?.click()}
                disabled={isDisabled}
                className="bg-primary hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                選擇檔案
              </Button>
              <input
                type="file"
                id="audioFile"
                accept=".mp3,.wav,.m4a,.aac,.flac,.mp4,.aiff,.aif,.ogg,.webm,.3gp,.amr"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={isDisabled}
              />
            </CardContent>
          </Card>

          {/* Selected file preview */}
          {selectedFile && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-medium text-slate-900 break-all">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    disabled={isUploading || isDisabled}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedFile && (
            <div className="mt-6 text-center">
              <Button
                onClick={handleUpload}
                disabled={isUploading || isDisabled}
                className="bg-success hover:bg-emerald-700 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg w-full sm:w-auto"
                size="lg"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    開始轉錄
                  </>
                )}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Enhanced Keywords Section */}
      <Card className="mt-6">
        <CardContent className="p-4 sm:p-6">
          <KeywordInput
            value={keywords}
            onChange={setKeywords}
            placeholder="輸入關鍵字，用逗號分隔（例如：科技,AI,機器學習）"
          />
          <div className="mt-3 flex items-start space-x-2 text-xs text-slate-500">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <p>關鍵字可幫助提升轉錄準確度，特別是專業術語或人名。</p>
              <p className="mt-1">僅支援英文字母、數字和基本符號。重複的關鍵字會自動去除。</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}