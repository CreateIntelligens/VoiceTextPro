import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, File, X, CloudUpload, Tag, Save, RotateCcw, Info } from "lucide-react";
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
  const [savedKeywords, setSavedKeywords] = useState<string>("");
  const { toast } = useToast();

  // Load saved keywords on component mount
  useEffect(() => {
    const saved = localStorage.getItem('transcription-keywords');
    if (saved) {
      setSavedKeywords(saved);
      setKeywords(saved);
    }
  }, []);

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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-blue-600" />
                <Label htmlFor="keywords" className="text-sm font-medium text-slate-900">
                  自定義關鍵字（可選）
                </Label>
                {getKeywordCount() > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {getKeywordCount()} 個關鍵字
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {savedKeywords && savedKeywords !== keywords && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadSavedKeywords}
                    className="text-xs"
                  >
                    載入已儲存
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveKeywords}
                  disabled={!keywords.trim() || keywords === savedKeywords}
                  className="text-xs"
                >
                  <Save className="w-3 h-3 mr-1" />
                  儲存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetKeywords}
                  disabled={!keywords.trim()}
                  className="text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  清除
                </Button>
              </div>
            </div>
            
            <div className="space-y-3">
              <Textarea
                id="keywords"
                placeholder="輸入英文專業詞彙以提高轉錄準確度，例如：AiTAGO, Fanpokka, LINE, LIFF 等&#10;多個關鍵字請用逗號分隔，每行一個或用逗號分隔"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isDisabled}
              />
              
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800 space-y-1">
                    <p><strong>使用說明：</strong></p>
                    <ul className="space-y-1 ml-2">
                      <li>• 輸入英文關鍵字（公司名稱、產品名稱、技術術語等）</li>
                      <li>• 多個關鍵字用<strong>逗號分隔</strong>：AiTAGO, LINE, LIFF</li>
                      <li>• 或<strong>每行一個</strong>關鍵字</li>
                      <li>• 點擊「儲存」按鈕保存設定，下次自動載入</li>
                      <li>• 系統僅支援英文字母、數字、連字號和底線</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              {getKeywordCount() > 0 && (
                <div className="flex flex-wrap gap-2">
                  {validateKeywords(keywords).slice(0, 10).map((keyword, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {validateKeywords(keywords).length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{validateKeywords(keywords).length - 10} 更多
                    </Badge>
                  )}
                </div>
              )}
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
