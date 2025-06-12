import { transcriptions, type Transcription, type InsertTranscription, type UpdateTranscription } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Transcription methods
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
  getTranscription(id: number): Promise<Transcription | undefined>;
  updateTranscription(id: number, updates: UpdateTranscription): Promise<Transcription | undefined>;
  getAllTranscriptions(): Promise<Transcription[]>;
  getUserTranscriptions(userId: number): Promise<Transcription[]>;
  deleteTranscription(id: number): Promise<boolean>;
  
  // Configuration methods
  getTranscriptionConfig(userId: number): Promise<any>;
  saveTranscriptionConfig(userId: number, config: any): Promise<void>;
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

  async getUserTranscriptions(userId: number): Promise<Transcription[]> {
    const results = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId))
      .orderBy(desc(transcriptions.createdAt));

    return results.map(transcription => {
      let speakers = undefined;
      let segments = undefined;
      
      // Handle JSONB fields
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
    });
  }

  async deleteTranscription(id: number): Promise<boolean> {
    const result = await db
      .delete(transcriptions)
      .where(eq(transcriptions.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Configuration methods - using in-memory storage for now
  private configStorage: Map<number, any> = new Map();

  async getTranscriptionConfig(userId: number): Promise<any> {
    const config = this.configStorage.get(userId);
    if (config) {
      return config;
    }
    
    // Return default configuration
    return {
      speaker_labels: true,
      speakers_expected: 4,
      speech_threshold: 0.3,
      language_detection: true,
      language_code: "auto",
      language_confidence_threshold: 0.6,
      boost_param: "high",
      multichannel: false,
      punctuate: true,
      format_text: true,
      disfluencies: false,
      filter_profanity: false,
      redact_pii: false,
      redact_pii_policies: [],
      summarization: true,
      auto_highlights: true,
      iab_categories: true,
      sentiment_analysis: false,
      entity_detection: true,
      content_safety: true,
      custom_topics: true,
      custom_keywords: "",
      config_name: "標準配置"
    };
  }

  async saveTranscriptionConfig(userId: number, config: any): Promise<void> {
    this.configStorage.set(userId, {
      ...config,
      updatedAt: new Date()
    });
  }
}

export const storage = new DatabaseStorage();
