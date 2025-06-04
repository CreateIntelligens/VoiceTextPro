import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, File, X, CloudUpload, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const validateFile = (file: File): boolean => {
    // 支援 iPhone 語音備忘錄和其他常見音頻格式
    const allowedTypes = [
      'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/mpeg',
      'audio/mp4', 'audio/x-m4a', 'audio/mpeg4-generic', 'audio/aiff', 'audio/x-aiff',
      'audio/ogg', 'audio/webm', 'audio/3gpp', 'audio/amr'
    ];
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.mp4', '.aiff', '.aif', '.ogg', '.webm', '.3gp', '.amr'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      toast({
        title: "檔案格式不支援",
        description: "請選擇支援的音頻格式，包括 iPhone 語音備忘錄 (M4A) 等格式。",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > maxSize) {
      toast({
        title: "檔案過大",
        description: "檔案大小不能超過 100MB。",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', selectedFile);
      if (keywords.trim()) {
        formData.append('keywords', keywords.trim());
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
        description: "正在開始轉錄程序...",
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
        <h2 className="text-3xl font-bold text-slate-900 mb-2">上傳語音檔案</h2>
        <p className="text-slate-600">支援 iPhone 語音備忘錄、MP3、WAV、M4A 等多種音頻格式，獲得高品質的繁體中文語音轉錄</p>
      </div>

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
        <CardContent className="p-8 text-center">
          <div className="mb-4">
            <CloudUpload className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">拖拽檔案至此處或點擊上傳</h3>
          <p className="text-slate-600 mb-4">最大檔案大小：100MB</p>
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

      {/* Keywords input section */}
      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <Label htmlFor="keywords" className="text-sm font-medium text-slate-900">
                自定義關鍵字（可選）
              </Label>
            </div>
            <div className="space-y-2">
              <Textarea
                id="keywords"
                placeholder="輸入專業詞彙以提高轉錄準確度，例如：公司名稱、產品名稱、技術術語等，用逗號分隔"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isDisabled}
              />
              <p className="text-xs text-slate-500">
                系統已包含常用商業詞彙。您可以添加特定領域的專業術語來獲得更準確的轉錄結果。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedFile && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <File className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-slate-900">{selectedFile.name}</p>
                  <p className="text-sm text-slate-600">{formatFileSize(selectedFile.size)}</p>
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
            className="bg-success hover:bg-emerald-700 text-white font-semibold px-8 py-4 text-lg"
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
    </div>
  );
}
