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
  assemblyaiId: text("assemblyai_id"),
  transcriptText: text("transcript_text"),
  speakers: jsonb("speakers"), // Array of speaker information
  segments: jsonb("segments"), // Array of transcript segments with speaker labels
  confidence: real("confidence"), // Overall confidence as decimal
  duration: integer("duration"), // Audio duration in seconds
  wordCount: integer("word_count"),
  errorMessage: text("error_message"),
  // Advanced features
  summary: text("summary"), // Auto-generated summary
  summaryType: text("summary_type"), // bullets, paragraph, headline
  autoHighlights: jsonb("auto_highlights"), // Key phrases and highlights
  autoChapters: jsonb("auto_chapters"), // Auto-generated chapters
  topicsDetection: jsonb("topics_detection"), // Detected topics and IAB categories
  sentimentAnalysis: jsonb("sentiment_analysis"), // Sentiment analysis results
  entityDetection: jsonb("entity_detection"), // Named entities (persons, locations, etc.)
  contentSafety: jsonb("content_safety"), // Content moderation results
  // Recording metadata
  recordingType: text("recording_type"), // 'recorded' or 'uploaded'
  recordingDuration: integer("recording_duration"), // Actual recording time in seconds (up to 10800 for 180 minutes)
  notes: text("notes"), // Additional metadata notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTranscriptionSchema = createInsertSchema(transcriptions).pick({
  filename: true,
  originalName: true,
  fileSize: true,
  recordingType: true,
  recordingDuration: true,
  notes: true,
}).partial({
  recordingType: true,
  recordingDuration: true,
  notes: true,
});

export const updateTranscriptionSchema = createInsertSchema(transcriptions).pick({
  displayName: true,
  status: true,
  progress: true,
  assemblyaiId: true,
  transcriptText: true,
  speakers: true,
  segments: true,
  confidence: true,
  duration: true,
  wordCount: true,
  errorMessage: true,
  summary: true,
  summaryType: true,
  autoHighlights: true,
  autoChapters: true,
  topicsDetection: true,
  sentimentAnalysis: true,
  entityDetection: true,
  contentSafety: true,
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
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, active, suspended
  isFirstLogin: boolean("is_first_login").notNull().default(true),
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

// Add user ownership to transcriptions
export const transcriptionsWithUser = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  displayName: text("display_name"),
  fileSize: integer("file_size").notNull(),
  status: text("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  assemblyaiId: text("assemblyai_id"),
  transcriptText: text("transcript_text"),
  speakers: jsonb("speakers"),
  segments: jsonb("segments"),
  confidence: real("confidence"),
  duration: integer("duration"),
  wordCount: integer("word_count"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
