import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Download, Trash2 } from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface ErrorSectionProps {
  transcription: TranscriptionStatus;
  onRetry?: () => void;
  onDelete?: () => void;
}

export default function ErrorSection({ transcription, onRetry, onDelete }: ErrorSectionProps) {
  const getErrorDetails = (errorMessage: string) => {
    const commonErrors = {
      "轉錄程序異常結束": {
        title: "轉錄程序異常結束",
        description: "轉錄過程中發生未預期的錯誤，可能是由於檔案格式不支援或 API 服務暫時不可用。",
        suggestions: [
          "檢查音頻檔案格式是否支援（MP3、WAV、M4A 等）",
          "確認檔案大小未超過 100MB 限制",
          "稍後再試，可能是服務暫時繁忙"
        ]
      },
      "API key": {
        title: "API 認證失敗",
        description: "無法連接到語音轉錄服務，請聯繫系統管理員。",
        suggestions: [
          "請聯繫系統管理員檢查 API 設定",
          "可能是服務配額已滿"
        ]
      },
      "network": {
        title: "網路連接錯誤",
        description: "無法連接到轉錄服務，請檢查網路連接。",
        suggestions: [
          "檢查網路連接是否正常",
          "稍後再試"
        ]
      },
      "timeout": {
        title: "處理超時",
        description: "檔案處理時間超過預期，可能是檔案過大或格式複雜。",
        suggestions: [
          "嘗試縮短音頻長度",
          "檢查音頻品質設定"
        ]
      }
    };

    // 查找匹配的錯誤類型
    for (const [key, error] of Object.entries(commonErrors)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return error;
      }
    }

    // 預設錯誤
    return {
      title: "轉錄失敗",
      description: errorMessage || "發生未知錯誤，請重試或聯繫技術支援。",
      suggestions: [
        "檢查檔案格式和大小",
        "重新上傳檔案",
        "如果問題持續，請聯繫技術支援"
      ]
    };
  };

  const errorDetails = getErrorDetails(transcription.errorMessage || "");

  return (
    <Card className="mb-8 border-red-200 bg-red-50">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* Error Icon */}
          <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Error Title */}
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              {errorDetails.title}
            </h3>
            
            {/* Error Description */}
            <p className="text-red-800 mb-4">
              {errorDetails.description}
            </p>
            
            {/* File Info */}
            <div className="bg-white border border-red-200 rounded-lg p-3 mb-4">
              <div className="text-sm text-gray-600">
                <p><strong>檔案：</strong>{transcription.originalName}</p>
                <p><strong>大小：</strong>{(transcription.fileSize / 1024 / 1024).toFixed(2)} MB</p>
                <p><strong>狀態：</strong>轉錄失敗</p>
                {transcription.errorMessage && (
                  <p><strong>錯誤詳情：</strong>{transcription.errorMessage}</p>
                )}
              </div>
            </div>
            
            {/* Suggestions */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">建議解決方案：</h4>
              <ul className="text-sm text-red-800 space-y-1">
                {errorDetails.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-red-500 mr-2">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {onRetry && (
                <Button 
                  onClick={onRetry}
                  variant="outline" 
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新轉錄
                </Button>
              )}
              
              <Button 
                onClick={() => {
                  // 下載原始檔案
                  const link = document.createElement('a');
                  link.href = `/uploads/${transcription.filename}`;
                  link.download = transcription.originalName;
                  link.click();
                }}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                <Download className="w-4 h-4 mr-2" />
                下載原檔案
              </Button>
              
              {onDelete && (
                <Button 
                  onClick={onDelete}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  刪除記錄
                </Button>
              )}
            </div>
            
            {/* Support Contact */}
            <div className="mt-4 p-3 bg-red-100 rounded border border-red-200">
              <p className="text-xs text-red-700">
                如果問題持續發生，請將錯誤信息提供給技術支援團隊以獲得協助。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}