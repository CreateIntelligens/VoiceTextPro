import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { storage } from "./storage";
import { GeminiAnalyzer } from "./gemini-analysis";
import { UsageTracker } from "./usage-tracker";
import AdminLogger from "./admin-logger";
import { AuthService, requireAuth, requireAdmin, type AuthenticatedRequest } from "./auth";
import { db } from "./db";
import { insertTranscriptionSchema, updateTranscriptionSchema, transcriptions, users, accountApplications, notifications, insertApplicationSchema, chatSessions, chatMessages, insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";

// Temporary in-memory storage for keywords per transcription
const transcriptionKeywords = new Map<number, string>();

// Upload audio file to AssemblyAI
async function uploadAudioFile(filePath: string): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("ASSEMBLYAI_API_KEY not configured");
  }

  const fileBuffer = await fs.readFile(filePath);
  
  const response = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'authorization': apiKey,
    },
    body: fileBuffer
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} - ${await response.text()}`);
  }

  const result = await response.json();
  return result.upload_url;
}

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
  // Note: Admin user will be initialized on first login attempt

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email 和密碼為必填項目" });
      }

      const result = await AuthService.login(email, password);
      if (!result) {
        return res.status(401).json({ message: "Email 或密碼錯誤" });
      }

      res.cookie('auth_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({ user: result.user, token: result.token });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "登入失敗" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
      
      if (token) {
        await AuthService.logout(token);
      }

      res.clearCookie('auth_token');
      res.json({ message: "登出成功" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "登出失敗" });
    }
  });

  app.post("/api/auth/apply", async (req, res) => {
    try {
      const validatedData = insertApplicationSchema.parse(req.body);
      
      await AuthService.applyForAccount(
        validatedData.email,
        validatedData.name || '',
        validatedData.reason || ''
      );

      res.json({ message: "申請已提交，請等待管理員審核" });
    } catch (error) {
      console.error("Application error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "申請失敗" 
      });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    res.json({ user: req.user });
  });

  // Admin routes for user management
  app.get("/api/admin/applications", requireAdmin, async (req, res) => {
    try {
      const applications = await db
        .select()
        .from(accountApplications)
        .orderBy(desc(accountApplications.appliedAt));

      res.json(applications);
    } catch (error) {
      console.error("Get applications error:", error);
      res.status(500).json({ message: "獲取申請列表失敗" });
    }
  });

  app.post("/api/admin/applications/:id/approve", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const applicationId = parseInt(req.params.id);
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "需要設定密碼" });
      }

      const [application] = await db
        .select()
        .from(accountApplications)
        .where(eq(accountApplications.id, applicationId))
        .limit(1);

      if (!application) {
        return res.status(404).json({ message: "找不到申請記錄" });
      }

      if (application.status !== 'pending') {
        return res.status(400).json({ message: "申請已被處理" });
      }

      // Create user account
      await AuthService.createUser(application.email, password, application.name || '');

      // Update application status
      await db
        .update(accountApplications)
        .set({
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        })
        .where(eq(accountApplications.id, applicationId));

      res.json({ message: "帳號已成功開通" });
    } catch (error) {
      console.error("Approve application error:", error);
      res.status(500).json({ message: "開通帳號失敗" });
    }
  });

  app.post("/api/admin/applications/:id/reject", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const applicationId = parseInt(req.params.id);

      await db
        .update(accountApplications)
        .set({
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        })
        .where(eq(accountApplications.id, applicationId));

      res.json({ message: "申請已拒絕" });
    } catch (error) {
      console.error("Reject application error:", error);
      res.status(500).json({ message: "拒絕申請失敗" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const userList = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          status: users.status,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      res.json(userList);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ message: "獲取用戶列表失敗" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(desc(notifications.createdAt));

      res.json(userNotifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "獲取通知失敗" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const notificationId = parseInt(req.params.id);

      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, req.user!.id)
        ));

      res.json({ message: "通知已標記為已讀" });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "標記通知失敗" });
    }
  });

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
      
      // Check if we should use recovery mode or fast mode
      const useRecovery = req.body.useRecovery || false;
      const useFast = req.body.useFast !== false; // Default to fast mode
      
      let scriptName: string;
      let args: string[];
      
      if (useRecovery) {
        scriptName = "recovery_transcription.py";
        args = [scriptName, filePath, id.toString()];
      } else if (useFast) {
        // Use optimized fast transcription with file upload
        scriptName = "fast_transcription.py";
        // First upload the file, then use the upload URL
        console.log(`[LOG-${id}] Uploading audio file for fast transcription...`);
        const uploadUrl = await uploadAudioFile(filePath);
        console.log(`[LOG-${id}] Audio uploaded, starting fast transcription...`);
        args = [scriptName, id.toString(), uploadUrl, process.env.ASSEMBLYAI_API_KEY || ""];
        if (customKeywords) {
          args.push(customKeywords);
        }
      } else {
        scriptName = "simple_transcription.py";
        args = [scriptName, filePath, id.toString()];
        if (customKeywords) {
          args.push(customKeywords);
        }
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
      // Disable caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
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
      // Disable caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
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
      
      // Restore original segments and speakers from utterances
      const originalSegments = data.utterances?.map((utterance: any) => {
        const totalSeconds = Math.floor(utterance.start / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timestamp = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return {
          text: utterance.text,
          speaker: utterance.speaker,
          start: utterance.start,
          end: utterance.end,
          confidence: Math.round(utterance.confidence * 100),
          timestamp: timestamp
        };
      }) || [];

      // Get unique speakers and create speaker objects
      const colors = ['hsl(220, 70%, 50%)', 'hsl(120, 70%, 50%)', 'hsl(0, 70%, 50%)', 'hsl(280, 70%, 50%)', 'hsl(45, 70%, 50%)', 'hsl(180, 70%, 50%)'];
      const speakerIds = data.utterances?.map((u: any) => u.speaker) || [];
      const uniqueSpeakerIds: string[] = [];
      speakerIds.forEach((id: string) => {
        if (!uniqueSpeakerIds.includes(id)) {
          uniqueSpeakerIds.push(id);
        }
      });
      
      const originalSpeakers = uniqueSpeakerIds.map((speakerId, index) => ({
        id: speakerId,
        label: `講者 ${speakerId}`,
        color: colors[index % colors.length]
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

  // Segment cleaned text with AI speaker assignment
  app.post("/api/transcriptions/:id/segment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { cleanedText } = req.body;

      if (!cleanedText) {
        return res.status(400).json({ message: "需要提供整理後的文字" });
      }

      const transcription = await storage.getTranscription(id);
      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      const originalSpeakers = Array.isArray(transcription.speakers) ? transcription.speakers : [];
      if (originalSpeakers.length === 0) {
        return res.status(400).json({ message: "沒有原始講者資料" });
      }

      const analyzer = new GeminiAnalyzer();
      const segmentResult = await analyzer.segmentCleanedText(cleanedText, originalSpeakers);

      // Convert AI segments to our format
      const updatedSegments = segmentResult.segments.map((segment: any, index: number) => ({
        text: segment.text,
        speaker: segment.speakerId,
        start: index * 10000,
        end: (index + 1) * 10000,
        confidence: 100,
        timestamp: `${Math.floor(index / 6).toString().padStart(2, '0')}:${((index % 6) * 10).toString().padStart(2, '0')}`
      }));

      // Update transcription with segmented content
      const updatedTranscription = await storage.updateTranscription(id, {
        transcriptText: cleanedText,
        segments: updatedSegments,
        speakers: originalSpeakers
      });

      res.json(updatedTranscription);
    } catch (error) {
      console.error("Segment transcription error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "AI 語意分段失敗" 
      });
    }
  });

  // Get usage statistics
  app.get("/api/usage/stats", async (req, res) => {
    try {
      const usageTracker = new UsageTracker();
      const stats = await usageTracker.getUsageStats();
      res.json(stats);
    } catch (error) {
      console.error("Get usage stats error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "獲取使用統計失敗" 
      });
    }
  });

  // Get monthly usage trend
  app.get("/api/usage/trend", async (req, res) => {
    try {
      const usageTracker = new UsageTracker();
      const trend = await usageTracker.getMonthlyTrend();
      res.json(trend);
    } catch (error) {
      console.error("Get usage trend error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "獲取使用趨勢失敗" 
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

  // Admin logs API routes - temporarily accessible for debugging
  app.get("/api/admin/logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await AdminLogger.getLogs(limit);
      
      // Log access attempt
      await AdminLogger.log({
        category: "admin",
        action: "logs_accessed",
        description: "管理員日誌被訪問查看",
        severity: "info",
        details: {
          access_time: new Date().toISOString(),
          requested_limit: limit,
          logs_returned: logs.length
        }
      });
      
      res.json(logs);
    } catch (error) {
      console.error("Get admin logs error:", error);
      res.status(500).json({ message: "獲取管理員日誌失敗" });
    }
  });

  app.post("/api/admin/logs", async (req, res) => {
    try {
      const logData = req.body;
      const log = await AdminLogger.log(logData);
      res.json(log);
    } catch (error) {
      console.error("Create admin log error:", error);
      res.status(500).json({ message: "創建管理員日誌失敗" });
    }
  });

  app.delete("/api/admin/logs", async (req, res) => {
    try {
      await AdminLogger.clearLogs();
      
      // Log clear action
      await AdminLogger.log({
        category: "admin",
        action: "logs_cleared",
        description: "管理員日誌已被清空",
        severity: "warning",
        details: {
          cleared_time: new Date().toISOString(),
          action_source: "admin_interface"
        }
      });
      
      res.json({ message: "管理員日誌已清空" });
    } catch (error) {
      console.error("Clear admin logs error:", error);
      res.status(500).json({ message: "清空管理員日誌失敗" });
    }
  });

  // Chat bot API routes
  app.get("/api/chat/sessions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const sessions = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.userId, userId))
        .orderBy(desc(chatSessions.updatedAt));
      
      res.json(sessions);
    } catch (error) {
      console.error("Get chat sessions error:", error);
      res.status(500).json({ message: "獲取對話記錄失敗" });
    }
  });

  app.post("/api/chat/sessions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const validatedData = insertChatSessionSchema.parse(req.body);
      
      const [session] = await db
        .insert(chatSessions)
        .values({
          ...validatedData,
          userId,
        })
        .returning();

      await AdminLogger.log({
        category: "chat",
        action: "session_created",
        description: `用戶創建新的客服對話：${validatedData.title || '未命名'}`,
        severity: "info",
        userId,
        details: {
          sessionId: session.sessionId,
          category: validatedData.category,
          priority: validatedData.priority
        }
      });

      res.json(session);
    } catch (error) {
      console.error("Create chat session error:", error);
      res.status(500).json({ message: "創建對話失敗" });
    }
  });

  app.get("/api/chat/messages/:sessionId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const userId = req.user!.id;

      // Verify session belongs to user
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));

      if (!session) {
        return res.status(404).json({ message: "對話不存在" });
      }

      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      res.json(messages);
    } catch (error) {
      console.error("Get chat messages error:", error);
      res.status(500).json({ message: "獲取對話訊息失敗" });
    }
  });

  app.post("/api/chat/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const validatedData = insertChatMessageSchema.parse(req.body);
      
      // Verify session belongs to user
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, validatedData.sessionId), eq(chatSessions.userId, userId)));

      if (!session) {
        return res.status(404).json({ message: "對話不存在" });
      }

      const [message] = await db
        .insert(chatMessages)
        .values({
          ...validatedData,
          userId,
        })
        .returning();

      // Update session timestamp
      await db
        .update(chatSessions)
        .set({ updatedAt: new Date() })
        .where(eq(chatSessions.id, validatedData.sessionId));

      await AdminLogger.log({
        category: "chat",
        action: "message_sent",
        description: `用戶在對話 ${session.title || session.sessionId} 中發送訊息`,
        severity: "info",
        userId,
        details: {
          sessionId: session.sessionId,
          messageLength: validatedData.message.length,
          messageType: validatedData.messageType
        }
      });

      res.json(message);
    } catch (error) {
      console.error("Send chat message error:", error);
      res.status(500).json({ message: "發送訊息失敗" });
    }
  });

  // Admin chat management routes
  app.get("/api/admin/chat/sessions", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const sessions = await db
        .select({
          id: chatSessions.id,
          sessionId: chatSessions.sessionId,
          title: chatSessions.title,
          status: chatSessions.status,
          priority: chatSessions.priority,
          category: chatSessions.category,
          assignedTo: chatSessions.assignedTo,
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
          resolvedAt: chatSessions.resolvedAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(chatSessions)
        .leftJoin(users, eq(chatSessions.userId, users.id))
        .orderBy(desc(chatSessions.updatedAt));

      res.json(sessions);
    } catch (error) {
      console.error("Get admin chat sessions error:", error);
      res.status(500).json({ message: "獲取客服對話失敗" });
    }
  });

  app.post("/api/admin/chat/sessions/:id/reply", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { message } = req.body;
      const adminId = req.user!.id;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: "回覆內容不能為空" });
      }

      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ message: "對話不存在" });
      }

      const [reply] = await db
        .insert(chatMessages)
        .values({
          sessionId,
          userId: adminId,
          message: message.trim(),
          messageType: "admin",
        })
        .returning();

      // Update session timestamp and assign to admin
      await db
        .update(chatSessions)
        .set({ 
          updatedAt: new Date(),
          assignedTo: adminId
        })
        .where(eq(chatSessions.id, sessionId));

      await AdminLogger.log({
        category: "chat",
        action: "admin_reply",
        description: `管理員回覆客服對話：${session.title || session.sessionId}`,
        severity: "info",
        userId: adminId,
        details: {
          sessionId: session.sessionId,
          replyLength: message.length
        }
      });

      res.json(reply);
    } catch (error) {
      console.error("Admin chat reply error:", error);
      res.status(500).json({ message: "發送回覆失敗" });
    }
  });

  app.patch("/api/admin/chat/sessions/:id/status", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { status } = req.body;
      const adminId = req.user!.id;

      if (!['active', 'resolved', 'archived'].includes(status)) {
        return res.status(400).json({ message: "無效的狀態值" });
      }

      const updateData: any = { 
        status, 
        updatedAt: new Date(),
        assignedTo: adminId
      };

      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      await db
        .update(chatSessions)
        .set(updateData)
        .where(eq(chatSessions.id, sessionId));

      await AdminLogger.log({
        category: "chat",
        action: "status_updated",
        description: `管理員更新客服對話狀態為：${status}`,
        severity: "info",
        userId: adminId,
        details: {
          sessionId,
          newStatus: status
        }
      });

      res.json({ message: "狀態更新成功" });
    } catch (error) {
      console.error("Update chat session status error:", error);
      res.status(500).json({ message: "更新狀態失敗" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
