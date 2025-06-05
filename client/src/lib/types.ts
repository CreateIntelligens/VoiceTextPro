export interface TranscriptionStatus {
  id: number;
  filename: string;
  originalName: string;
  displayName?: string;
  fileSize: number;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
  assemblyaiId?: string;
  transcriptText?: string;
  speakers?: Speaker[];
  segments?: TranscriptSegment[];
  confidence?: number;
  duration?: number;
  wordCount?: number;
  errorMessage?: string;
  // Advanced AI features
  summary?: string;
  summaryType?: string;
  autoHighlights?: {
    status: string;
    results: Array<{
      text: string;
      count: number;
      rank: number;
      timestamps: Array<{ start: number; end: number }>;
    }>;
  };
  autoChapters?: Array<{
    gist: string;
    headline: string;
    summary: string;
    start: number;
    end: number;
  }>;
  topicsDetection?: {
    status: string;
    results: Array<{
      text: string;
      labels: Array<{ relevance: number; label: string }>;
      timestamp: { start: number; end: number };
    }>;
  };
  sentimentAnalysis?: Array<{
    text: string;
    sentiment: string;
    confidence: number;
    start: number;
    end: number;
  }>;
  entityDetection?: Array<{
    entity_type: string;
    text: string;
    start: number;
    end: number;
  }>;
  contentSafety?: {
    status: string;
    results: Array<{
      text: string;
      labels: Array<{ confidence: number; label: string }>;
      timestamp: { start: number; end: number };
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Speaker {
  id: string;
  label: string;
  color: string;
}

export interface TranscriptSegment {
  text: string;
  speaker: string;
  start: number;
  end: number;
  confidence: number;
  timestamp: string;
}
