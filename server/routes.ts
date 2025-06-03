import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { storage } from "./storage";
import { insertTranscriptionSchema, updateTranscriptionSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/mpeg'];
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.flac'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式。請使用 MP3、WAV、M4A、AAC 或 FLAC 格式。'));
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
        originalName: req.file.originalname,
        fileSize: req.file.size,
      };

      const validatedData = insertTranscriptionSchema.parse(transcriptionData);
      const transcription = await storage.createTranscription(validatedData);

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

      // Start Python transcription process
      const filePath = path.join("uploads", transcription.filename);
      const pythonProcess = spawn("python", ["server/transcription.py", filePath, id.toString()]);

      pythonProcess.stdout.on("data", async (data) => {
        try {
          const output = data.toString().trim();
          if (output.startsWith("PROGRESS:")) {
            const progress = parseInt(output.split(":")[1]);
            await storage.updateTranscription(id, { progress });
          } else if (output.startsWith("RESULT:")) {
            const result = JSON.parse(output.substring(7));
            await storage.updateTranscription(id, {
              status: "completed",
              progress: 100,
              assemblyaiId: result.id,
              transcriptText: result.text,
              speakers: result.speakers,
              segments: result.segments,
              confidence: result.confidence,
              duration: result.audio_duration,
              wordCount: result.words?.length || 0,
            });
          }
        } catch (error) {
          console.error("Error processing Python output:", error);
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

  // Get all transcriptions
  app.get("/api/transcriptions", async (req, res) => {
    try {
      const transcriptions = await storage.getAllTranscriptions();
      res.json(transcriptions);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "獲取轉錄記錄失敗" });
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
