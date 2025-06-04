import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
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
