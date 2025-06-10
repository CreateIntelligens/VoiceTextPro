import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MicOff, Languages, Users, Zap, History, RefreshCw } from "lucide-react";
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
  const queryClient = useQueryClient();

  // Query for all transcriptions
  const { data: allTranscriptions = [] } = useQuery<TranscriptionStatus[]>({
    queryKey: ["/api/transcriptions"],
    // No automatic polling - use manual refresh only
  });

  // Query for current transcription status
  const { data: transcription, refetch } = useQuery<TranscriptionStatus>({
    queryKey: ["/api/transcriptions", currentTranscriptionId],
    enabled: !!currentTranscriptionId,
    refetchInterval: (query) => {
      // Continue polling while processing
      const status = query.state.data?.status;
      return status === "processing" || status === "pending" ? 1500 : false;
    },
    staleTime: 0, // Always consider data stale for fresh updates
  });

  // Also try to get transcription from the list if available
  const currentTranscription = transcription || (currentTranscriptionId ? allTranscriptions.find(t => t.id === currentTranscriptionId) : null);

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
    console.log('Selecting transcription:', id);
    setCurrentTranscriptionId(id);
    // Force refresh of specific transcription data
    if (id) {
      refetch();
    }
  };

  const handleManualRefresh = () => {
    // Invalidate all transcription-related queries to force fresh data
    queryClient.invalidateQueries({ queryKey: ["/api/transcriptions"] });
    if (currentTranscriptionId) {
      queryClient.invalidateQueries({ queryKey: ["/api/transcriptions", currentTranscriptionId] });
    }
  };

  // Handle case where currentTranscription might be an array
  const actualTranscription = Array.isArray(currentTranscription) ? currentTranscription[0] : currentTranscription;

  const showUpload = !currentTranscriptionId || actualTranscription?.status === "error";
  const showProcessing = actualTranscription?.status === "processing" || actualTranscription?.status === "pending";
  const showResults = actualTranscription?.status === "completed";
  const showError = actualTranscription?.status === "error";

  // Debug logging
  console.log('Current transcription ID:', currentTranscriptionId);
  console.log('Actual transcription:', actualTranscription);
  console.log('Show results:', showResults);
  console.log('Status:', actualTranscription?.status);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-8">
          {/* Left sidebar - Transcription list */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="lg:sticky lg:top-4">
              <div className="mb-4">
                <Button 
                  onClick={handleManualRefresh}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新整理狀態
                </Button>
              </div>
              <TranscriptionList 
                transcriptions={allTranscriptions}
                onSelectTranscription={handleSelectTranscription}
                selectedId={currentTranscriptionId || undefined}
              />
            </div>
          </div>
          
          {/* Main content */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            {showUpload && (
              <UploadSection 
                onFileUploaded={handleFileUploaded} 
                isDisabled={showProcessing}
              />
            )}

            {showProcessing && actualTranscription && (
              <ProcessingSection transcription={actualTranscription} />
            )}

            {showResults && actualTranscription && (
              <ResultsSection transcription={actualTranscription} />
            )}

            {showError && actualTranscription && (
              <ErrorSection transcription={actualTranscription} onRetry={handleRetry} />
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12">
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
