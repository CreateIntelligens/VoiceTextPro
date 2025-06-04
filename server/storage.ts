import { transcriptions, type Transcription, type InsertTranscription, type UpdateTranscription } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Transcription methods
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
  getTranscription(id: number): Promise<Transcription | undefined>;
  updateTranscription(id: number, updates: UpdateTranscription): Promise<Transcription | undefined>;
  getAllTranscriptions(): Promise<Transcription[]>;
  deleteTranscription(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async createTranscription(insertTranscription: InsertTranscription): Promise<Transcription> {
    const [transcription] = await db
      .insert(transcriptions)
      .values(insertTranscription)
      .returning();
    return transcription;
  }

  async getTranscription(id: number): Promise<Transcription | undefined> {
    const [transcription] = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.id, id));
    
    if (!transcription) return undefined;
    
    // Parse JSON fields
    return {
      ...transcription,
      speakers: transcription.speakers ? JSON.parse(transcription.speakers as string) : undefined,
      segments: transcription.segments ? JSON.parse(transcription.segments as string) : undefined,
    };
  }

  async updateTranscription(id: number, updates: UpdateTranscription): Promise<Transcription | undefined> {
    const [transcription] = await db
      .update(transcriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transcriptions.id, id))
      .returning();
    return transcription || undefined;
  }

  async getAllTranscriptions(): Promise<Transcription[]> {
    const transcripts = await db
      .select()
      .from(transcriptions)
      .orderBy(desc(transcriptions.createdAt));
    
    // Parse JSON fields for all transcriptions
    return transcripts.map(transcription => {
      let speakers = undefined;
      let segments = undefined;
      
      // Safe parse speakers
      if (transcription.speakers) {
        try {
          const speakersStr = transcription.speakers as string;
          if (speakersStr.startsWith('[') || speakersStr.startsWith('{')) {
            speakers = JSON.parse(speakersStr);
          }
        } catch (error) {
          console.error('Speakers parse error for transcription', transcription.id, error);
        }
      }
      
      // Safe parse segments
      if (transcription.segments) {
        try {
          const segmentsStr = transcription.segments as string;
          if (segmentsStr.startsWith('[') || segmentsStr.startsWith('{')) {
            segments = JSON.parse(segmentsStr);
          }
        } catch (error) {
          console.error('Segments parse error for transcription', transcription.id, error);
        }
      }
      
      return {
        ...transcription,
        speakers,
        segments,
      };
    });
  }

  async deleteTranscription(id: number): Promise<boolean> {
    const result = await db
      .delete(transcriptions)
      .where(eq(transcriptions.id, id));
    return result.rowCount !== undefined && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
