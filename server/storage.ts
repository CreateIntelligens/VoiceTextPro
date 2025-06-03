import { transcriptions, type Transcription, type InsertTranscription, type UpdateTranscription } from "@shared/schema";

export interface IStorage {
  // Transcription methods
  createTranscription(transcription: InsertTranscription): Promise<Transcription>;
  getTranscription(id: number): Promise<Transcription | undefined>;
  updateTranscription(id: number, updates: UpdateTranscription): Promise<Transcription | undefined>;
  getAllTranscriptions(): Promise<Transcription[]>;
  deleteTranscription(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private transcriptions: Map<number, Transcription>;
  private currentTranscriptionId: number;

  constructor() {
    this.transcriptions = new Map();
    this.currentTranscriptionId = 1;
  }

  async createTranscription(insertTranscription: InsertTranscription): Promise<Transcription> {
    const id = this.currentTranscriptionId++;
    const now = new Date();
    const transcription: Transcription = {
      ...insertTranscription,
      id,
      status: "pending",
      progress: 0,
      assemblyaiId: null,
      transcriptText: null,
      speakers: null,
      segments: null,
      confidence: null,
      duration: null,
      wordCount: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.transcriptions.set(id, transcription);
    return transcription;
  }

  async getTranscription(id: number): Promise<Transcription | undefined> {
    return this.transcriptions.get(id);
  }

  async updateTranscription(id: number, updates: UpdateTranscription): Promise<Transcription | undefined> {
    const existing = this.transcriptions.get(id);
    if (!existing) return undefined;

    const updated: Transcription = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.transcriptions.set(id, updated);
    return updated;
  }

  async getAllTranscriptions(): Promise<Transcription[]> {
    return Array.from(this.transcriptions.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteTranscription(id: number): Promise<boolean> {
    return this.transcriptions.delete(id);
  }
}

export const storage = new MemStorage();
