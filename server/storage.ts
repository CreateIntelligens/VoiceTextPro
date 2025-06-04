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
    
    let speakers = undefined;
    let segments = undefined;
    
    // Handle JSONB fields - they come as parsed objects from the database
    if (transcription.speakers) {
      if (Array.isArray(transcription.speakers)) {
        speakers = transcription.speakers;
      } else if (typeof transcription.speakers === 'string') {
        try {
          speakers = JSON.parse(transcription.speakers);
        } catch (error) {
          console.error('Speakers parse error for transcription', transcription.id, error);
        }
      } else {
        speakers = transcription.speakers;
      }
    }
    
    if (transcription.segments) {
      if (Array.isArray(transcription.segments)) {
        segments = transcription.segments;
      } else if (typeof transcription.segments === 'string') {
        try {
          segments = JSON.parse(transcription.segments);
        } catch (error) {
          console.error('Segments parse error for transcription', transcription.id, error);
        }
      } else {
        segments = transcription.segments;
      }
    }
    
    return {
      ...transcription,
      speakers,
      segments,
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
      
      // Handle JSONB fields - they come as parsed objects from the database
      if (transcription.speakers) {
        if (Array.isArray(transcription.speakers)) {
          speakers = transcription.speakers;
        } else if (typeof transcription.speakers === 'string') {
          try {
            speakers = JSON.parse(transcription.speakers);
          } catch (error) {
            console.error('Speakers parse error for transcription', transcription.id, error);
          }
        } else {
          // Already a parsed object from JSONB
          speakers = transcription.speakers;
        }
      }
      
      // Handle JSONB fields - they come as parsed objects from the database
      if (transcription.segments) {
        if (Array.isArray(transcription.segments)) {
          segments = transcription.segments;
        } else if (typeof transcription.segments === 'string') {
          try {
            segments = JSON.parse(transcription.segments);
          } catch (error) {
            console.error('Segments parse error for transcription', transcription.id, error);
          }
        } else {
          // Already a parsed object from JSONB
          segments = transcription.segments;
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
