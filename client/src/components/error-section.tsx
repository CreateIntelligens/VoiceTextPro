import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, HelpCircle } from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface ErrorSectionProps {
  transcription: TranscriptionStatus;
  onRetry: () => void;
}

export default function ErrorSection({ transcription, onRetry }: ErrorSectionProps) {
  return (
    <Card className="mb-8 border-red-200 bg-red-50">
      <CardContent className="p-8">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-error rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">轉錄失敗</h3>
            <p className="text-red-700">
              {transcription.errorMessage || "轉錄過程中發生未知錯誤，請重試。"}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={onRetry}
            className="bg-error hover:bg-red-700 text-white"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            重新上傳
          </Button>
          <Button variant="outline" className="text-gray-500 hover:text-gray-700">
            <HelpCircle className="w-4 h-4 mr-2" />
            查看幫助
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
