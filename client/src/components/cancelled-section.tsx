import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, RotateCcw } from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface CancelledSectionProps {
  transcription: TranscriptionStatus;
  onRetry: () => void;
}

export default function CancelledSection({ transcription, onRetry }: CancelledSectionProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">轉錄已取消</h3>
            <p className="text-slate-600">此轉錄任務已被手動取消</p>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">檔案名稱:</span>
            <span className="text-slate-900 font-medium">{transcription.originalName}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-600">狀態:</span>
            <span className="text-gray-600 font-medium">已取消</span>
          </div>
          {transcription.errorMessage && (
            <div className="flex items-start justify-between text-sm mt-2">
              <span className="text-slate-600">原因:</span>
              <span className="text-gray-600 text-right max-w-xs">{transcription.errorMessage}</span>
            </div>
          )}
        </div>

        <div className="flex space-x-3">
          <Button 
            onClick={onRetry}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>重新上傳檔案</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}