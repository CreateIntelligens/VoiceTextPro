import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MicOff, Languages, Users, Zap, History } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import UploadSection from "@/components/upload-section";
import ProcessingSection from "@/components/processing-section";
import ResultsSection from "@/components/results-section";
import ErrorSection from "@/components/error-section";
import TranscriptionList from "@/components/transcription-list";
import type { TranscriptionStatus } from "@/lib/types";

export default function TranscriptionPage() {
  const [currentTranscriptionId, setCurrentTranscriptionId] = useState<number | null>(null);

  // Query for all transcriptions
  const { data: allTranscriptions = [] } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
    refetchInterval: 3000,
  });

  // Query for current transcription status
  const { data: transcription, refetch } = useQuery<TranscriptionStatus>({
    queryKey: ["/api/transcriptions", currentTranscriptionId],
    enabled: !!currentTranscriptionId,
    refetchInterval: (data) => {
      // Continue polling while processing
      return data?.status === "processing" ? 2000 : false;
    },
  });

  const handleFileUploaded = async (transcriptionId: number) => {
    setCurrentTranscriptionId(transcriptionId);
    
    // Start transcription process
    try {
      const response = await fetch(`/api/transcriptions/${transcriptionId}/start`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to start transcription');
      }
      
      // Start polling for updates
      refetch();
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  };

  const handleRetry = () => {
    setCurrentTranscriptionId(null);
  };

  const handleSelectTranscription = (id: number) => {
    setCurrentTranscriptionId(id);
  };

  const showUpload = !currentTranscriptionId || transcription?.status === "error";
  const showProcessing = transcription?.status === "processing";
  const showResults = transcription?.status === "completed";
  const showError = transcription?.status === "error";

  // Debug logging
  console.log('Current transcription:', transcription);
  console.log('Show results:', showResults);
  console.log('Transcription status:', transcription?.status);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MicOff className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">語音轉文字平台</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/results" className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">
                <History className="w-4 h-4 mr-2" />
                查看記錄
              </Link>
              <span className="text-sm text-slate-600">Powered by AssemblyAI</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left sidebar - Transcription list */}
          <div className="lg:col-span-1">
            <TranscriptionList 
              transcriptions={allTranscriptions}
              onSelectTranscription={handleSelectTranscription}
              selectedId={currentTranscriptionId || undefined}
            />
          </div>
          
          {/* Main content */}
          <div className="lg:col-span-3">
            {showUpload && (
              <UploadSection 
                onFileUploaded={handleFileUploaded} 
                isDisabled={showProcessing}
              />
            )}

            {showProcessing && transcription && (
              <ProcessingSection transcription={transcription} />
            )}

            {showResults && transcription && (
              <ResultsSection transcription={transcription} />
            )}

            {showError && transcription && (
              <ErrorSection transcription={transcription} onRetry={handleRetry} />
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">繁體中文支援</h3>
            <p className="text-slate-600">專門優化的繁體中文語音識別，提供最高品質的轉錄效果</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center">
            <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">多人對話識別</h3>
            <p className="text-slate-600">自動識別不同對話者，清楚標示每位講者的發言內容</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center">
            <div className="w-12 h-12 bg-warning rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">快速準確</h3>
            <p className="text-slate-600">採用 AssemblyAI 最佳模型，確保轉錄速度快且準確度高</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-600">
            <p>&copy; 2024 語音轉文字平台. 由 AssemblyAI 技術驅動</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
