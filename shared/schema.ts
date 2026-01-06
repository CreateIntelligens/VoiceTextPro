import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  displayName: text("display_name"),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, error
  progress: integer("progress").notNull().default(0),
  googleSpeechOperationId: text("google_speech_operation_id"), // Google Cloud Speech-to-Text 作業 ID
  transcriptText: text("transcript_text"),
  cleanedTranscriptText: text("cleaned_transcript_text"), // AI cleaned transcript text
  speakers: jsonb("speakers"), // Array of speaker information
  segments: jsonb("segments"), // Array of transcript segments with speaker labels
  cleanedSegments: jsonb("cleaned_segments"), // AI cleaned segments
  confidence: real("confidence"), // Overall confidence as decimal
  duration: integer("duration"), // Audio duration in seconds
  wordCount: integer("word_count"),
  errorMessage: text("error_message"),
  // Gemini AI Analysis Features
  summary: text("summary"), // Meeting summary with key points
  actionItems: jsonb("action_items"), // Action items and tasks
  speakerAnalysis: jsonb("speaker_analysis"), // Speaker identification and roles
  sentimentAnalysis: jsonb("sentiment_analysis"), // Emotion and tone analysis
  keyTopics: jsonb("key_topics"), // Extracted topics and themes
  keywordExtraction: jsonb("keyword_extraction"), // Important keywords and phrases
  meetingStructure: jsonb("meeting_structure"), // Meeting flow and structure
  // Legacy fields (kept for compatibility)
  summaryType: text("summary_type"), // bullets, paragraph, headline
  autoHighlights: jsonb("auto_highlights"), // Key phrases and highlights
  autoChapters: jsonb("auto_chapters"), // Auto-generated chapters
  topicsDetection: jsonb("topics_detection"), // Detected topics and IAB categories
  entityDetection: jsonb("entity_detection"), // Named entities (persons, locations, etc.)
  contentSafety: jsonb("content_safety"), // Content moderation results
  // Recording metadata
  recordingType: text("recording_type"), // 'recorded' or 'uploaded'
  recordingDuration: integer("recording_duration"), // Actual recording time in seconds (up to 10800 for 180 minutes)
  notes: text("notes"), // Additional metadata notes
  // Analysis mode and RD analysis
  analysisMode: text("analysis_mode").default("meeting"), // 'meeting' | 'rd'
  rdAnalysis: jsonb("rd_analysis"), // RD mode analysis result
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTranscriptionSchema = createInsertSchema(transcriptions).pick({
  filename: true,
  originalName: true,
  displayName: true,
  fileSize: true,
  recordingType: true,
  recordingDuration: true,
  notes: true,
  analysisMode: true,
}).partial({
  displayName: true,
  recordingType: true,
  recordingDuration: true,
  notes: true,
  analysisMode: true,
});

export const updateTranscriptionSchema = createInsertSchema(transcriptions).pick({
  displayName: true,
  status: true,
  progress: true,
  googleSpeechOperationId: true,
  transcriptText: true,
  cleanedTranscriptText: true,
  speakers: true,
  segments: true,
  cleanedSegments: true,
  confidence: true,
  duration: true,
  wordCount: true,
  errorMessage: true,
  summary: true,
  summaryType: true,
  actionItems: true,
  speakerAnalysis: true,
  autoHighlights: true,
  autoChapters: true,
  topicsDetection: true,
  sentimentAnalysis: true,
  entityDetection: true,
  contentSafety: true,
  keyTopics: true,
  keywordExtraction: true,
  meetingStructure: true,
  analysisMode: true,
  rdAnalysis: true,
}).partial();

export type InsertTranscription = z.infer<typeof insertTranscriptionSchema>;
export type UpdateTranscription = z.infer<typeof updateTranscriptionSchema>;
export type Transcription = typeof transcriptions.$inferSelect;

// Speaker type definition
export interface Speaker {
  id: string;
  name: string;
  color: string;
}

// Transcript segment type definition
export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
  startTime?: string;
  endTime?: string;
}

// Enhanced transcription status with proper typing
export type TranscriptionStatus = Transcription & {
  speakers?: Speaker[];
  segments?: TranscriptSegment[];
};

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull().default("user"), // admin, user
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, active, suspended, pending_verification
  isFirstLogin: boolean("is_first_login").notNull().default(true),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
}, (table) => [
  index("users_email_idx").on(table.email),
]);

// Account applications table
export const accountApplications = pgTable("account_applications", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }),
  reason: text("reason"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, approved, rejected
  appliedAt: timestamp("applied_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
});

// User sessions table for authentication
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("sessions_token_idx").on(table.token),
  index("sessions_user_id_idx").on(table.userId),
]);

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // account_application, system_alert
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin logs table for system debugging and change tracking
export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 50 }).notNull(), // transcription, ui_fix, color_fix, ai_analysis, etc.
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description").notNull(),
  details: jsonb("details"), // Additional structured data
  userId: integer("user_id").references(() => users.id),
  transcriptionId: integer("transcription_id").references(() => transcriptionsWithUser.id),
  severity: varchar("severity", { length: 20 }).notNull().default("info"), // info, warning, error, success
  createdAt: timestamp("created_at").defaultNow(),
});

// Alias for admin logs foreign key reference
// NOTE: This is the same table as 'transcriptions' - used only for foreign key references
export const transcriptionsWithUser = transcriptions;

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  status: true,
});

export const insertApplicationSchema = createInsertSchema(accountApplications).pick({
  email: true,
  name: true,
  reason: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type AccountApplication = typeof accountApplications.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = typeof adminLogs.$inferInsert;

// Chat bot feedback system
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  title: varchar("title", { length: 200 }),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, resolved, archived
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // low, medium, high, urgent
  category: varchar("category", { length: 50 }).notNull().default("general"), // general, bug, feature, question
  assignedTo: integer("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => chatSessions.id),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  messageType: varchar("message_type", { length: 20 }).notNull().default("user"), // user, admin, system
  attachments: jsonb("attachments"), // Array of file attachments
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat bot schemas
export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  sessionId: true,
  title: true,
  category: true,
  priority: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  sessionId: true,
  message: true,
  messageType: true,
  attachments: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// User keywords table for saving and reusing keywords
export const userKeywords = pgTable("user_keywords", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(), // User-defined name for keyword set
  keywords: text("keywords").notNull(), // Comma-separated keywords
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserKeywordSchema = createInsertSchema(userKeywords).pick({
  name: true,
  keywords: true,
});

export type UserKeyword = typeof userKeywords.$inferSelect;
export type InsertUserKeyword = z.infer<typeof insertUserKeywordSchema>;

// Push notification subscriptions table
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_endpoint_idx").on(table.endpoint),
]);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// Type definitions for transcript data
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
}

// Email verification tokens table
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_verification_token_idx").on(table.token),
  index("email_verification_user_idx").on(table.userId),
]);

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("password_reset_token_idx").on(table.token),
  index("password_reset_user_idx").on(table.userId),
]);

// System settings table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("system_settings_key_idx").on(table.key),
]);

// User limits table (for custom per-user limits, NULL means use default)
export const userLimits = pgTable("user_limits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  weeklyAudioMinutes: integer("weekly_audio_minutes"),      // 每週音頻分鐘
  monthlyAudioMinutes: integer("monthly_audio_minutes"),    // 每月音頻分鐘
  dailyTranscriptionCount: integer("daily_transcription_count"),  // 每日轉錄次數
  weeklyTranscriptionCount: integer("weekly_transcription_count"), // 每週轉錄次數
  maxFileSizeMb: integer("max_file_size_mb"),               // 單檔大小 (MB)
  totalStorageMb: integer("total_storage_mb"),              // 總儲存空間 (MB)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_limits_user_idx").on(table.userId),
]);

// User usage tracking table
export const userUsage = pgTable("user_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  periodType: varchar("period_type", { length: 20 }).notNull(), // 'daily', 'weekly', 'monthly'
  periodStart: timestamp("period_start").notNull(),
  audioMinutes: integer("audio_minutes").notNull().default(0),
  transcriptionCount: integer("transcription_count").notNull().default(0),
  storageBytesUsed: integer("storage_bytes_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("user_usage_user_period_idx").on(table.userId, table.periodType, table.periodStart),
]);

// Type exports for new tables
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type UserLimit = typeof userLimits.$inferSelect;
export type UserUsage = typeof userUsage.$inferSelect;

// Default system limits interface
export interface DefaultLimits {
  weeklyAudioMinutes: number;
  monthlyAudioMinutes: number;
  dailyTranscriptionCount: number;
  weeklyTranscriptionCount: number;
  maxFileSizeMb: number;
  totalStorageMb: number;
}

// System settings keys
export const SYSTEM_SETTING_KEYS = {
  REGISTRATION_MODE: 'registration_mode',           // 'open' | 'application'
  DEFAULT_LIMITS: 'default_limits',                 // DefaultLimits object
  EMAIL_VERIFICATION_REQUIRED: 'email_verification_required', // boolean
  PASSWORD_MIN_LENGTH: 'password_min_length',       // number
} as const;

// ==================== RD Analysis Types ====================

// Analysis mode type
export type AnalysisMode = 'meeting' | 'rd';

// User Story
export interface UserStory {
  id: string;
  asA: string;        // As a [role]
  iWant: string;      // I want [feature]
  soThat: string;     // So that [benefit]
  acceptanceCriteria: string[];
  priority: 'high' | 'medium' | 'low';
}

// Requirement (MoSCoW priority)
export interface Requirement {
  id: string;
  title: string;
  description: string;
  type: 'functional' | 'non-functional';
  priority: 'must' | 'should' | 'could' | 'wont';
  relatedUserStories: string[];
}

// API Endpoint
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

// System Architecture
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

// Database Table
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

// Technical Decision (ADR)
export interface TechnicalDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: string[];
  status: 'proposed' | 'accepted' | 'deprecated';
}

// Mermaid Diagram
export interface MermaidDiagram {
  title: string;
  description: string;
  code: string;
}

// RD Analysis Result
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

// ==================== Google Calendar Integration ====================

// User Google Calendar binding table
export const userGoogleCalendar = pgTable("user_google_calendar", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  googleEmail: varchar("google_email", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),       // AES-256-GCM encrypted
  refreshToken: text("refresh_token").notNull(),     // AES-256-GCM encrypted
  tokenIv: varchar("token_iv", { length: 32 }).notNull(), // Initialization vector for decryption
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("user_google_calendar_user_idx").on(table.userId),
]);

export type UserGoogleCalendar = typeof userGoogleCalendar.$inferSelect;
export type InsertUserGoogleCalendar = typeof userGoogleCalendar.$inferInsert;

// Google Calendar Event interface
export interface CalendarEvent {
  id: string;
  summary: string;  // Meeting title
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: {
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  location?: string;
  status?: string;
  htmlLink?: string;
}
