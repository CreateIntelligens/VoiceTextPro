import { Card, CardContent } from "@/components/ui/card";
import { Settings, CheckCircle, Clock } from "lucide-react";
import type { TranscriptionStatus } from "@/lib/types";

interface ProcessingSectionProps {
  transcription: TranscriptionStatus;
}

export default function ProcessingSection({ transcription }: ProcessingSectionProps) {
  const steps = [
    { label: "音頻檔案上傳完成", completed: transcription.progress >= 20 },
    { label: "正在進行語音識別...", completed: transcription.progress >= 50, current: transcription.progress < 80 },
    { label: "識別對話者...", completed: transcription.progress >= 80, current: transcription.progress >= 50 && transcription.progress < 100 },
    { label: "轉錄完成", completed: transcription.progress >= 100 },
  ];

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-10 h-10 bg-warning rounded-full flex items-center justify-center">
            <Settings className="w-5 h-5 text-white animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">正在處理您的音頻檔案</h3>
            <p className="text-slate-600">使用 AssemblyAI 最佳語音模型進行轉錄...</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>轉錄進度</span>
            <span>{transcription.progress}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-warning h-2 rounded-full transition-all duration-300"
              style={{ width: `${transcription.progress}%` }}
            />
          </div>
        </div>

        {/* Status Updates */}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center space-x-3 text-sm">
              {step.completed ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : step.current ? (
                <Settings className="w-4 h-4 text-warning animate-spin" />
              ) : (
                <Clock className="w-4 h-4 text-slate-400" />
              )}
              <span className={step.completed ? "text-slate-700" : step.current ? "text-slate-700" : "text-slate-500"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
