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
