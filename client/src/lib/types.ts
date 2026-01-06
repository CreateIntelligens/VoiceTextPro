export interface TranscriptionStatus {
  id: number;
  filename: string;
  originalName: string;
  displayName?: string;
  fileSize: number;
  status: "pending" | "processing" | "completed" | "error" | "cancelled";
  progress: number;
  assemblyaiId?: string;
  transcriptText?: string;
  cleanedTranscriptText?: string;
  speakers?: Speaker[];
  segments?: TranscriptSegment[];
  cleanedSegments?: TranscriptSegment[];
  confidence?: number;
  duration?: number;
  wordCount?: number;
  errorMessage?: string;
  // Advanced AI features
  summary?: string;
  summaryType?: string;
  actionItems?: ActionItem[];
  speakerAnalysis?: Record<string, SpeakerAnalysis>;
  autoHighlights?: string[] | {
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
  topicsDetection?: string[] | {
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
  entityDetection?: {
    actionItems?: string[];
    speakerAnalysis?: Record<string, SpeakerAnalysis>;
  } | Array<{
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
  // Analysis mode and RD analysis
  analysisMode?: AnalysisMode;
  rdAnalysis?: RDAnalysisResult;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  type: 'todo' | 'decision' | 'commitment' | 'deadline' | 'followup';
  content: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface SpeakerAnalysis {
  participation?: string;
  characteristics?: string;
  mainPoints?: string;
  參與度?: string;
  發言特點?: string;
  主要觀點?: string;
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

// ==================== RD Analysis Types ====================

export type AnalysisMode = 'meeting' | 'rd';

export interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non-functional';
  priority: 'must' | 'should' | 'could' | 'wont';
  relatedUserStories: string[];
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestBody?: {
    contentType: string;
    schema: Record<string, unknown>;
    example?: Record<string, unknown>;
  };
  responseBody?: {
    statusCode: number;
    schema: Record<string, unknown>;
    example?: Record<string, unknown>;
  };
  authentication?: string;
}

export interface ArchitectureDescription {
  overview: string;
  components: {
    name: string;
    description: string;
    technology?: string;
    responsibilities: string[];
  }[];
  interactions: {
    from: string;
    to: string;
    description: string;
  }[];
}

export interface DatabaseTable {
  tableName: string;
  description: string;
  columns: {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey?: boolean;
    foreignKey?: { table: string; column: string };
    description?: string;
  }[];
  indexes?: string[];
}

export interface TechnicalDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: string[];
  status: 'proposed' | 'accepted' | 'deprecated';
}

export interface MermaidDiagram {
  title: string;
  description: string;
  code: string;
}

export interface RDAnalysisResult {
  documents: {
    userStories: UserStory[];
    requirements: Requirement[];
    apiDesign: APIEndpoint[];
    systemArchitecture: ArchitectureDescription;
    databaseDesign: DatabaseTable[];
    technicalDecisions: TechnicalDecision[];
  };
  diagrams: {
    flowchart?: MermaidDiagram;
    sequenceDiagram?: MermaidDiagram;
    erDiagram?: MermaidDiagram;
    stateDiagram?: MermaidDiagram;
    c4Diagram?: MermaidDiagram;
  };
  metadata: {
    projectName?: string;
    discussionDate: string;
    participants: string[];
    summary: string;
  };
}
