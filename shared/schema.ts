import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transcriptions = pgTable("transcriptions", {
  id: serial("id").primaryKey(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTranscriptionSchema = createInsertSchema(transcriptions).pick({
  filename: true,
  originalName: true,
  fileSize: true,
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
}).partial();

export type InsertTranscription = z.infer<typeof insertTranscriptionSchema>;
export type UpdateTranscription = z.infer<typeof updateTranscriptionSchema>;
export type Transcription = typeof transcriptions.$inferSelect;

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 20 }).notNull().default("user"), // admin, user
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, active, suspended
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
