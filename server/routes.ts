import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { storage } from "./storage";
import { GeminiAnalyzer } from "./gemini-analysis";
import { db } from "./db";
import { insertTranscriptionSchema, updateTranscriptionSchema, transcriptions } from "@shared/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

// Temporary in-memory storage for keywords per transcription
const transcriptionKeywords = new Map<number, string>();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // 支援 iPhone 語音備忘錄和其他常見音頻格式
    const allowedMimes = [
      'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/mpeg',
      'audio/mp4', 'audio/x-m4a', 'audio/mpeg4-generic', 'audio/aiff', 'audio/x-aiff',
      'audio/ogg', 'audio/webm', 'audio/3gpp', 'audio/amr'
    ];
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.mp4', '.aiff', '.aif', '.ogg', '.webm', '.3gp', '.amr'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式。請使用 MP3、WAV、M4A、AAC、FLAC 或其他音頻格式。'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Create uploads directory if it doesn't exist
  try {
    await fs.access("uploads");
  } catch {
    await fs.mkdir("uploads", { recursive: true });
  }

  // Upload audio file
  app.post("/api/transcriptions/upload", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "未選擇檔案" });
      }

      const transcriptionData = {
        filename: req.file.filename,
        originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
        fileSize: req.file.size,
      };

      const validatedData = insertTranscriptionSchema.parse(transcriptionData);
      const transcription = await storage.createTranscription(validatedData);

      // Store keywords for later use in transcription
      if (req.body.keywords) {
        transcriptionKeywords.set(transcription.id, req.body.keywords);
        console.log(`[UPLOAD] Custom keywords stored for transcription ${transcription.id}: ${req.body.keywords}`);
      }

      res.json(transcription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "檔案上傳失敗" });
    }
  });

  // Start transcription
  app.post("/api/transcriptions/:id/start", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== "pending") {
        return res.status(400).json({ message: "轉錄已經開始或完成" });
      }

      // Update status to processing
      await storage.updateTranscription(id, { status: "processing", progress: 0 });

      // Start Python transcription process with real AssemblyAI and custom keywords
      const filePath = path.join("uploads", transcription.filename);
      const customKeywords = transcriptionKeywords.get(id) || "";
      console.log(`[LOG-${id}] Starting real transcription for file: ${filePath}`);
      if (customKeywords) {
        console.log(`[LOG-${id}] Using custom keywords: ${customKeywords}`);
      }
      
      const args = ["fixed_transcription.py", filePath, id.toString()];
      if (customKeywords) {
        args.push(customKeywords);
      }
      const pythonProcess = spawn("python3", args);
      
      // Import and start auto-monitoring
      let assemblyaiId = null;

      let outputBuffer = "";
      
      pythonProcess.stdout.on("data", async (data) => {
        try {
          outputBuffer += data.toString();
          const lines = outputBuffer.split('\n');
          outputBuffer = lines.pop() || ""; // Keep incomplete line in buffer
          
          for (const line of lines) {
            const output = line.trim();
            if (!output) continue;
            
            console.log(`[LOG-${id}] Python output: "${output}"`);
            
            if (output.startsWith("PROGRESS:")) {
              const progress = parseInt(output.split(":")[1]);
              console.log(`[LOG-${id}] Updating progress to ${progress}%`);
              await storage.updateTranscription(id, { progress });
              console.log(`[LOG-${id}] Progress update completed`);
            } else if (output.startsWith("RESULT:")) {
              console.log(`[LOG-${id}] Processing transcription result`);
              const resultJson = output.substring(7);
              console.log(`[LOG-${id}] Result JSON length: ${resultJson.length}`);
              const result = JSON.parse(resultJson);
              console.log(`[LOG-${id}] Parsed result keys:`, Object.keys(result));
              console.log(`[LOG-${id}] Text length: ${result.transcript_text?.length || 0}`);
              console.log(`[LOG-${id}] Speaker count: ${result.speakers?.length || 0}`);
              
              await storage.updateTranscription(id, {
                status: "completed",
                progress: 100,
                assemblyaiId: result.assemblyai_id,
                transcriptText: result.transcript_text,
                speakers: result.speakers,
                segments: result.segments,
                confidence: result.confidence,
                duration: result.duration,
                wordCount: result.word_count,
              });
              // Clean up keywords from memory
              transcriptionKeywords.delete(id);
              console.log(`[LOG-${id}] Transcription marked as completed`);
            } else if (output.startsWith("ERROR:")) {
              console.log(`[LOG-${id}] Error received: ${output}`);
              await storage.updateTranscription(id, {
                status: "error",
                errorMessage: output.substring(6),
              });
              // Clean up keywords from memory on error
              transcriptionKeywords.delete(id);
            } else if (output.startsWith("DEBUG:")) {
              console.log(`[LOG-${id}] Debug: ${output}`);
            } else if (output.startsWith("SUCCESS:")) {
              console.log(`[LOG-${id}] Success message: ${output}`);
            }
          }
        } catch (error) {
          console.error(`[LOG-${id}] Error processing output:`, error);
          console.error(`[LOG-${id}] Raw output: "${data.toString()}"`);
        }
      });

      pythonProcess.stderr.on("data", async (data) => {
        const error = data.toString().trim();
        console.error("Python transcription error:", error);
        await storage.updateTranscription(id, {
          status: "error",
          errorMessage: error,
        });
      });

      pythonProcess.on("exit", async (code) => {
        if (code !== 0) {
          await storage.updateTranscription(id, {
            status: "error",
            errorMessage: "轉錄程序異常結束",
          });
        }
      });

      res.json({ message: "轉錄已開始" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "啟動轉錄失敗" });
    }
  });

  // Get transcription by ID
  app.get("/api/transcriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      res.json(transcription);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "獲取轉錄記錄失敗" });
    }
  });

  // Update transcription (for naming)
  app.patch("/api/transcriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = updateTranscriptionSchema.parse(req.body);
      
      const updatedTranscription = await storage.updateTranscription(id, updateData);
      
      if (!updatedTranscription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }
      
      res.json(updatedTranscription);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
      }
      res.status(500).json({ message: error instanceof Error ? error.message : "更新失敗" });
    }
  });

  // Get all transcriptions
  app.get("/api/transcriptions", async (req, res) => {
    try {
      const transcriptions = await storage.getAllTranscriptions();
      res.json(transcriptions);
    } catch (error) {
      console.error("Failed to get transcriptions:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "獲取轉錄記錄失敗" });
    }
  });

  // Analyze transcription with Gemini AI
  app.post("/api/transcriptions/:id/analyze", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行分析" });
      }

      const analyzer = new GeminiAnalyzer();
      const analysis = await analyzer.analyzeTranscription(transcription);

      res.json(analysis);
    } catch (error) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "AI 分析失敗" 
      });
    }
  });

  // Clean transcription text with Gemini AI
  app.post("/api/transcriptions/:id/clean", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行整理" });
      }

      if (!transcription.transcriptText) {
        return res.status(400).json({ message: "沒有可整理的逐字稿內容" });
      }

      const analyzer = new GeminiAnalyzer();
      const cleanedResult = await analyzer.cleanTranscript(transcription.transcriptText);

      res.json(cleanedResult);
    } catch (error) {
      console.error("Gemini cleaning error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "逐字稿整理失敗" 
      });
    }
  });

  // Restore original transcription data from AssemblyAI
  app.post("/api/transcriptions/:id/restore", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription || !transcription.assemblyaiId) {
        return res.status(404).json({ message: "找不到轉錄記錄或 AssemblyAI ID" });
      }

      // Fetch original data from AssemblyAI
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcription.assemblyaiId}`, {
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY || ''
        }
      });

      if (!response.ok) {
        throw new Error('無法從 AssemblyAI 獲取原始資料');
      }

      const data = await response.json();
      
      function formatTimestamp(milliseconds: number): string {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      function getSpeakerColor(index: number): string {
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16'];
        return colors[index % colors.length];
      }
      
      // Restore original segments and speakers
      const originalSegments = data.utterances?.map((utterance: any, index: number) => ({
        text: utterance.text,
        speaker: utterance.speaker,
        start: utterance.start,
        end: utterance.end,
        confidence: Math.round(utterance.confidence * 100),
        timestamp: formatTimestamp(utterance.start)
      })) || [];

      const originalSpeakers = [...new Set(data.utterances?.map((u: any) => u.speaker) || [])]
        .map((speakerId, index) => ({
          id: speakerId,
          label: `講者 ${String.fromCharCode(65 + index)}`,
          color: getSpeakerColor(index)
        }));

      // Update transcription with original data
      const updatedTranscription = await storage.updateTranscription(id, {
        segments: originalSegments,
        speakers: originalSpeakers,
        transcriptText: data.text
      });

      res.json(updatedTranscription);
    } catch (error) {
      console.error("Restore transcription error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "恢復原始轉錄資料失敗" 
      });
    }
  });

  // Delete transcription
  app.delete("/api/transcriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      // Delete the uploaded file
      try {
        await fs.unlink(path.join("uploads", transcription.filename));
      } catch (error) {
        console.warn("Failed to delete file:", error);
      }

      const deleted = await storage.deleteTranscription(id);
      if (deleted) {
        res.json({ message: "刪除成功" });
      } else {
        res.status(404).json({ message: "找不到轉錄記錄" });
      }
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "刪除失敗" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
