import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as nodeFs from "fs";
import { spawn } from "child_process";
import { storage } from "./storage";
import { GeminiAnalyzer } from "./gemini-analysis";
import { VertexAI } from "@google-cloud/vertexai";

import { UsageTracker } from "./usage-tracker";
import AdminLogger from "./admin-logger";
import { AuthService, requireAuth, requireAdmin, type AuthenticatedRequest } from "./auth";
import { db } from "./db";
import { insertTranscriptionSchema, updateTranscriptionSchema, transcriptions, users, accountApplications, notifications, insertApplicationSchema, chatSessions, chatMessages, insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { LimitService } from "./limit-service";
import { UserUsageService } from "./user-usage-service";

// Vertex AI 輔助函數（使用 ADC 認證，不需要 API key）
function getVertexAIModel() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || "wonderland-nft";
  const vertexAI = new VertexAI({
    project: projectId,
    location: "us-central1",
  });
  return vertexAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
}

// Google Cloud Speech-to-Text 轉錄處理函數（支援說話人識別）
async function processSpeechToTextTranscription(transcriptionId: number, audioFilePath: string): Promise<void> {
  // 獲取轉錄記錄以取得用戶 ID 和檔名
  const transcription = await storage.getTranscription(transcriptionId);
  const userId = transcription?.userId || null;
  const filename = transcription?.originalName || '音檔';

  try {
    console.log(`[Speech-to-Text-${transcriptionId}] 開始 Google Cloud Speech-to-Text 轉錄: ${audioFilePath}`);

    // 建立 GeminiAnalyzer 實例（包含 Speech-to-Text 客戶端）
    const analyzer = new GeminiAnalyzer();

    // 使用 Speech-to-Text 進行轉錄，帶進度回調
    const result = await analyzer.transcribeWithChirp3(audioFilePath, async (progress: number) => {
      await storage.updateTranscription(transcriptionId, { progress });
      console.log(`[Speech-to-Text-${transcriptionId}] 進度: ${progress}%`);
    });

    console.log(`[Speech-to-Text-${transcriptionId}] 轉錄完成. 文字長度: ${result.transcriptText?.length || 0}, 字數: ${result.wordCount}, 講者: ${result.speakers?.length || 0}位`);

    // 更新轉錄結果到資料庫
    await storage.updateTranscription(transcriptionId, {
      status: "completed",
      progress: 100,
      transcriptText: result.transcriptText || '',
      speakers: result.speakers,
      segments: result.segments,
      confidence: 0.9,
      duration: result.duration,
      wordCount: result.wordCount,
    });

    console.log(`[Speech-to-Text-${transcriptionId}] Speech-to-Text 轉錄已完成`);

    // 記錄使用量
    try {
      if (userId !== null) {
        const durationMinutes = (result.duration || 0) / 60;
        const transcriptionRecord = await storage.getTranscription(transcriptionId);
        await UserUsageService.recordUsage(
          userId,
          durationMinutes,
          transcriptionRecord?.fileSize || 0
        );
        console.log(`[Speech-to-Text-${transcriptionId}] 使用量已記錄: ${durationMinutes.toFixed(2)} 分鐘`);
      }
    } catch (usageError) {
      console.warn(`[Speech-to-Text-${transcriptionId}] 記錄使用量失敗:`, usageError);
    }

    console.log(`[Speech-to-Text-${transcriptionId}] 轉錄完成通知已發送`);

  } catch (error) {
    console.error(`[Speech-to-Text-${transcriptionId}] 轉錄錯誤:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    await storage.updateTranscription(transcriptionId, {
      status: "error",
      errorMessage: `語音辨識失敗: ${errorMessage}`,
    });

    console.log(`[Speech-to-Text-${transcriptionId}] 轉錄失敗通知已發送`);
  }
}

// Create different upload configurations for regular users and admins
const createUploadConfig = (isAdmin: boolean = false) => multer({
  dest: "uploads/",
  limits: {
    fileSize: isAdmin ? undefined : 500 * 1024 * 1024, // No limit for admin, 500MB for users
  },
  fileFilter: (req, file, cb) => {
    // 支援 iPhone 語音備忘錄和其他常見音頻格式
    const allowedMimes = [
      'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/flac', 'audio/mpeg',
      'audio/mp4', 'audio/x-m4a', 'audio/mpeg4-generic', 'audio/aiff', 'audio/x-aiff',
      'audio/ogg', 'audio/webm', 'audio/3gpp', 'audio/amr',
      // 增加更多 M4A 變體支援
      'audio/mp4a-latm', 'audio/mpeg4', 'video/mp4', 'application/mp4'
    ];
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.mp4', '.aiff', '.aif', '.ogg', '.webm', '.3gp', '.amr'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    // 特別處理 M4A 檔案
    if (ext === '.m4a') {
      console.log(`[M4A-DEBUG] 檔案: ${file.originalname}, MIME類型: ${file.mimetype}`);
      cb(null, true);
      return;
    }
    
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支援的檔案格式。請使用 MP3、WAV、M4A、AAC、FLAC 或其他音頻格式。'));
    }
  }
});

const upload = createUploadConfig(false); // Default upload for regular users
const adminUpload = createUploadConfig(true); // Unlimited upload for admins

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

      // 如果有錯誤訊息（帳號狀態問題）
      if (result.error) {
        return res.status(401).json({ message: result.error });
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

  // User self-registration with email verification
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email 和密碼為必填項目" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "密碼必須至少 8 個字符" });
      }

      // Check registration mode
      const registrationMode = await AuthService.getRegistrationMode();

      // Get base URL for verification link
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;

      const result = await AuthService.registerWithEmailVerification(email, password, name, baseUrl);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        message: result.message,
        success: true,
        requiresVerification: result.requiresVerification
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "註冊失敗，請稍後再試" });
    }
  });

  // Admin creates user (original flow - no email verification)
  app.post("/api/auth/admin-register", requireAdmin, async (req, res) => {
    try {
      const { email, name, role = 'user' } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email 為必填項目" });
      }

      const result = await AuthService.registerUser(email, name, role);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        message: "註冊成功！密碼已發送到用戶郵箱",
        success: true
      });
    } catch (error) {
      console.error("Admin registration error:", error);
      res.status(500).json({ message: "註冊失敗，請稍後再試" });
    }
  });

  // Password reset request (send reset link)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email 為必填項目" });
      }

      // Get base URL for reset link
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;

      const result = await AuthService.sendPasswordResetLink(email, baseUrl);

      // Always return success to prevent email enumeration
      res.json({
        message: "如果該信箱已註冊，您將收到密碼重設連結",
        success: true
      });
    } catch (error) {
      console.error("Password reset error:", error);
      // Still return success to prevent enumeration
      res.json({
        message: "如果該信箱已註冊，您將收到密碼重設連結",
        success: true
      });
    }
  });

  // Verify password reset token
  app.get("/api/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const result = await AuthService.verifyResetToken(token);

      if (!result.valid) {
        return res.status(400).json({
          valid: false,
          message: result.error || "無效或已過期的重設連結"
        });
      }

      res.json({
        valid: true,
        email: result.email
      });
    } catch (error) {
      console.error("Verify reset token error:", error);
      res.status(400).json({
        valid: false,
        message: "驗證失敗"
      });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "缺少必要參數" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "密碼必須至少 8 個字符" });
      }

      const result = await AuthService.resetPasswordWithToken(token, newPassword);

      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({
        message: "密碼已成功重設，請使用新密碼登入",
        success: true
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "密碼重設失敗，請稍後再試" });
    }
  });

  // Change password (for first-time login or user-initiated changes)
  app.post("/api/auth/change-password", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { newPassword } = req.body;
      const user = req.user;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "密碼必須至少6個字符" });
      }

      const result = await AuthService.changePassword(user!.id, newPassword);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }

      res.json({ 
        message: "密碼更改成功",
        success: true 
      });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "密碼更改失敗，請稍後再試" });
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

  // Get registration mode
  app.get("/api/auth/registration-mode", async (req, res) => {
    try {
      const mode = await AuthService.getRegistrationMode();
      res.json({ mode });
    } catch (error) {
      console.error("Get registration mode error:", error);
      res.status(500).json({ message: "獲取註冊模式失敗" });
    }
  });

  // Email verification endpoint
  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const result = await AuthService.verifyEmail(token);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || "驗證失敗"
        });
      }

      res.json({
        success: true,
        message: "Email 驗證成功！您現在可以登入系統",
        email: result.email
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({
        success: false,
        message: "驗證失敗，請稍後再試"
      });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "請提供 Email" });
      }

      // Get base URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
      const baseUrl = `${protocol}://${host}`;

      const result = await AuthService.resendVerificationEmail(email, baseUrl);

      // Always return success to prevent enumeration
      res.json({
        success: true,
        message: "如果該信箱需要驗證，驗證郵件已發送"
      });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.json({
        success: true,
        message: "如果該信箱需要驗證，驗證郵件已發送"
      });
    }
  });

  // ==================== 用戶使用量和限制 API ====================

  // Get current user's usage stats
  app.get("/api/user/usage", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const usage = await LimitService.getUserUsage(userId);
      res.json(usage);
    } catch (error) {
      console.error("Get user usage error:", error);
      res.status(500).json({ message: "獲取使用量失敗" });
    }
  });

  // Get current user's limits
  app.get("/api/user/limits", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const limits = await LimitService.getUserLimits(userId);
      res.json(limits);
    } catch (error) {
      console.error("Get user limits error:", error);
      res.status(500).json({ message: "獲取限制設定失敗" });
    }
  });

  // Get current user's usage history
  app.get("/api/user/usage-history", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const periodType = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
      const limit = parseInt(req.query.limit as string) || 30;

      const history = await UserUsageService.getUsageHistory(userId, periodType, limit);
      res.json(history);
    } catch (error) {
      console.error("Get usage history error:", error);
      res.status(500).json({ message: "獲取使用歷史失敗" });
    }
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

  // ==================== 管理員系統設定 API ====================

  // Get registration mode (admin)
  app.get("/api/admin/settings/registration-mode", requireAdmin, async (req, res) => {
    try {
      const mode = await AuthService.getRegistrationMode();
      res.json({ mode });
    } catch (error) {
      console.error("Get registration mode error:", error);
      res.status(500).json({ message: "獲取註冊模式失敗" });
    }
  });

  // Set registration mode (admin)
  app.patch("/api/admin/settings/registration-mode", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { mode } = req.body;

      if (!['open', 'application'].includes(mode)) {
        return res.status(400).json({ message: "無效的註冊模式" });
      }

      await AuthService.setRegistrationMode(mode);

      await AdminLogger.log({
        category: "admin",
        action: "registration_mode_changed",
        description: `註冊模式已更改為: ${mode === 'open' ? '開放註冊' : '申請制'}`,
        severity: "info",
        userId: req.user!.id,
        details: { newMode: mode }
      });

      res.json({ message: "註冊模式已更新", mode });
    } catch (error) {
      console.error("Set registration mode error:", error);
      res.status(500).json({ message: "更新註冊模式失敗" });
    }
  });

  // ==================== 管理員限制設定 API ====================

  // Get default limits
  app.get("/api/admin/default-limits", requireAdmin, async (req, res) => {
    try {
      const limits = await LimitService.getDefaultLimits();
      res.json(limits);
    } catch (error) {
      console.error("Get default limits error:", error);
      res.status(500).json({ message: "獲取預設限制失敗" });
    }
  });

  // Update default limits
  app.patch("/api/admin/default-limits", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const updates = req.body;
      const newLimits = await LimitService.setDefaultLimits(updates);

      await AdminLogger.log({
        category: "admin",
        action: "default_limits_updated",
        description: "系統預設使用限制已更新",
        severity: "info",
        userId: req.user!.id,
        details: updates
      });

      res.json({ message: "預設限制已更新", limits: newLimits });
    } catch (error) {
      console.error("Update default limits error:", error);
      res.status(500).json({ message: "更新預設限制失敗" });
    }
  });

  // Get specific user's limits
  app.get("/api/admin/users/:id/limits", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const limits = await LimitService.getUserLimits(userId);
      res.json(limits);
    } catch (error) {
      console.error("Get user limits error:", error);
      res.status(500).json({ message: "獲取用戶限制失敗" });
    }
  });

  // Set specific user's limits
  app.patch("/api/admin/users/:id/limits", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { limits, notes } = req.body;

      await LimitService.setUserLimits(userId, limits, notes);

      await AdminLogger.log({
        category: "admin",
        action: "user_limits_updated",
        description: `用戶 ${userId} 的使用限制已更新`,
        severity: "info",
        userId: req.user!.id,
        details: { targetUserId: userId, limits, notes }
      });

      res.json({ message: "用戶限制已更新" });
    } catch (error) {
      console.error("Set user limits error:", error);
      res.status(500).json({ message: "更新用戶限制失敗" });
    }
  });

  // Remove user's custom limits (reset to default)
  app.delete("/api/admin/users/:id/limits", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);

      await LimitService.removeUserLimits(userId);

      await AdminLogger.log({
        category: "admin",
        action: "user_limits_removed",
        description: `用戶 ${userId} 的自訂限制已移除，恢復為預設值`,
        severity: "info",
        userId: req.user!.id,
        details: { targetUserId: userId }
      });

      res.json({ message: "已恢復預設限制" });
    } catch (error) {
      console.error("Remove user limits error:", error);
      res.status(500).json({ message: "移除用戶限制失敗" });
    }
  });

  // Get specific user's usage stats (admin)
  app.get("/api/admin/users/:id/usage", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const usage = await LimitService.getUserUsage(userId);
      res.json(usage);
    } catch (error) {
      console.error("Get user usage error:", error);
      res.status(500).json({ message: "獲取用戶使用量失敗" });
    }
  });

  // Get users who are over limit
  app.get("/api/admin/users/over-limit", requireAdmin, async (req, res) => {
    try {
      const overLimitUsers = await LimitService.getOverLimitUsers();
      res.json(overLimitUsers);
    } catch (error) {
      console.error("Get over limit users error:", error);
      res.status(500).json({ message: "獲取超額用戶列表失敗" });
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

  // Upload audio file with enhanced error handling
  app.post("/api/transcriptions/upload", requireAuth, (req: AuthenticatedRequest, res) => {
    // Use admin upload config for admins, regular upload for users
    const uploadHandler = req.user!.role === 'admin' ? adminUpload.single("audio") : upload.single("audio");
    
    uploadHandler(req, res, async (err) => {
      try {
        // Handle multer errors
        if (err) {
          console.error("Multer upload error:", err);
          if (err.code === 'LIMIT_FILE_SIZE') {
            const limitMessage = req.user!.role === 'admin' 
              ? "檔案上傳失敗" 
              : "檔案大小超過限制（最大 500MB）";
            return res.status(400).json({ message: limitMessage });
          }
          return res.status(400).json({ message: err.message || "檔案上傳失敗" });
        }

        if (!req.file) {
          return res.status(400).json({ message: "未選擇檔案" });
        }

        console.log(`[UPLOAD] File uploaded: ${req.file.originalname}, size: ${req.file.size}`);

        // Check user limits before processing
        const fileSizeMb = req.file.size / (1024 * 1024);
        const limitCheck = await LimitService.checkUserLimits(req.user!.id, fileSizeMb);

        if (!limitCheck.allowed) {
          // Delete the uploaded file since we're rejecting it
          try {
            await fs.unlink(path.join("uploads", req.file.filename));
          } catch (e) {
            console.error("Failed to delete rejected file:", e);
          }
          return res.status(403).json({
            message: limitCheck.message || "已達使用限制",
            limitType: limitCheck.limitType,
            current: limitCheck.current,
            limit: limitCheck.limit
          });
        }

        // Check if this is a recording file (contains timestamp pattern)
        const isRecording = req.file.originalname.includes('recording_');
        const recordingType = isRecording ? 'recorded' : 'uploaded';

        // Dynamic notes based on user role and file type
        let notes = 'User uploaded file';
        if (isRecording) {
          notes = req.user!.role === 'admin' 
            ? 'System recorded audio (unlimited duration for admin)' 
            : 'System recorded audio (supports up to 180 minutes)';
        } else if (req.user!.role === 'admin') {
          notes = 'Admin uploaded file (no size restrictions)';
        }

        // Get analysis mode from form data (default to 'meeting')
        const analysisMode = (req.body?.analysisMode === 'rd' ? 'rd' : 'meeting') as 'meeting' | 'rd';
        console.log(`[UPLOAD] Analysis mode: ${analysisMode}`);

        // Get displayName from form data (optional - for Google Calendar meeting name or custom name)
        const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null;
        if (displayName) {
          console.log(`[UPLOAD] Display name: ${displayName}`);
        }

        const transcriptionData = {
          userId: req.user!.id,
          filename: req.file.filename,
          originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
          displayName: displayName || undefined,
          fileSize: req.file.size,
          recordingType: recordingType,
          notes: notes,
          analysisMode: analysisMode,
        };

        const validatedData = insertTranscriptionSchema.parse(transcriptionData);
        const transcription = await storage.createTranscription(validatedData);

        // Log admin privilege usage
        if (req.user!.role === 'admin') {
          await AdminLogger.log({
            category: 'admin_privileges',
            action: 'unlimited_upload_recording',
            description: `管理員 ${req.user!.email} 使用無限制上傳/錄音功能`,
            details: {
              transcriptionId: transcription.id,
              fileSize: req.file.size,
              originalName: req.file.originalname,
              recordingType: recordingType
            }
          });
        }

        console.log(`[UPLOAD] Transcription created with ID: ${transcription.id}`);
        res.json(transcription);
      } catch (error) {
        console.error("Upload processing error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: error instanceof Error ? error.message : "檔案上傳失敗" });
      }
    });
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

      // 使用 Google Cloud Speech-to-Text 進行轉錄和說話人識別
      const filePath = path.join("uploads", transcription.filename);
      console.log(`[Speech-to-Text-${id}] 開始 Speech-to-Text 轉錄: ${filePath}`);

      // 非同步處理轉錄
      processSpeechToTextTranscription(id, filePath).catch(error => {
        console.error(`[Speech-to-Text-${id}] 轉錄失敗:`, error);
        storage.updateTranscription(id, {
          status: "error",
          errorMessage: "語音辨識失敗: " + (error instanceof Error ? error.message : String(error))
        });
      });

      res.json({ 
        message: "轉錄處理已開始", 
        status: "processing",
        progress: 0
      });
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

  // Cancel transcription
  app.post("/api/transcriptions/:id/cancel", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== "processing") {
        return res.status(400).json({ message: "只能取消正在處理中的轉錄" });
      }

      // Kill any running Python processes for this transcription
      try {
        const { spawn } = await import('child_process');
        const killProcess = spawn('pkill', ['-f', `python.*${id}`]);
        killProcess.on('close', (code) => {
          console.log(`[LOG-${id}] Process cleanup completed with code: ${code}`);
        });
      } catch (error) {
        console.error(`[LOG-${id}] Error killing processes:`, error);
      }

      // Update status to cancelled
      await storage.updateTranscription(id, { 
        status: "cancelled", 
        progress: 0,
        errorMessage: "用戶取消轉錄" 
      });

      // Log cancellation
      await AdminLogger.log({
        category: "transcription_cancel",
        action: `cancel_transcription_${id}`,
        description: "用戶手動取消轉錄任務",
        severity: "low",
        details: {
          transcription_id: id,
          filename: transcription.filename,
          previous_status: transcription.status
        }
      });

      res.json({ message: "轉錄已取消" });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : "取消失敗" });
    }
  });

  // Update transcription (for naming)
  app.patch("/api/transcriptions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = updateTranscriptionSchema.parse(req.body);
      
      // If updating with segments, extract and create speakers array
      if (updateData.segments && Array.isArray(updateData.segments)) {
        const speakersMap = new Map();
        const colors = ['hsl(220, 70%, 50%)', 'hsl(120, 70%, 50%)', 'hsl(0, 70%, 50%)', 'hsl(280, 70%, 50%)', 'hsl(30, 70%, 50%)', 'hsl(180, 70%, 50%)'];
        
        updateData.segments.forEach((segment: any) => {
          if (segment.speaker && !speakersMap.has(segment.speaker)) {
            speakersMap.set(segment.speaker, {
              id: segment.speaker,
              label: segment.speaker,
              color: colors[speakersMap.size % colors.length]
            });
          }
        });
        
        // Add speakers array to update data
        if (speakersMap.size > 0) {
          updateData.speakers = Array.from(speakersMap.values());
        }
      }
      
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

  // AI Analysis endpoint
  app.post("/api/transcriptions/:id/ai-analysis", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const transcription = await storage.getTranscription(transcriptionId);
      
      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        return res.status(403).json({ message: "無權限執行此操作" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行AI分析" });
      }

      // 優先使用整理後的逐字稿，沒有則使用原始逐字稿
      const textToAnalyze = (transcription as any).cleanedTranscriptText || transcription.transcriptText;

      if (!textToAnalyze) {
        return res.status(400).json({ message: "缺少轉錄文本，無法進行分析。請先進行逐字稿整理。" });
      }

      console.log(`[AI Analysis] 使用${(transcription as any).cleanedTranscriptText ? '整理後' : '原始'}逐字稿進行分析`);

      // Use Vertex AI for analysis (ADC 認證)
      const model = getVertexAIModel();

      const analysisPrompt = `
請對以下中文轉錄內容進行全面的AI智能分析，並以JSON格式回應：

轉錄內容：
${textToAnalyze.substring(0, 15000)}

請提供以下分析結果（請用繁體中文回應）：

1. summary: 內容摘要（200字以內）

2. keyTopics: 關鍵主題和話題（陣列格式，最多10個）

3. actionItems: 重點追蹤事項（陣列格式，每項為物件），請分析並提取：
   - type: 類型，可為 "todo"(待辦)、"decision"(決策)、"commitment"(承諾)、"deadline"(時間節點)、"followup"(追蹤)
   - content: 具體內容描述
   - assignee: 負責人（如有提及）
   - dueDate: 截止日期（如有提及）
   - priority: 優先級 "high"(高)、"medium"(中)、"low"(低)

   範例格式：
   [
     {"type": "todo", "content": "準備下週會議資料", "assignee": "講者A", "priority": "high"},
     {"type": "decision", "content": "確定採用方案B", "priority": "medium"},
     {"type": "deadline", "content": "專案截止日", "dueDate": "下週五", "priority": "high"}
   ]

4. highlights: 重要段落摘錄（陣列格式，最多5個）

5. speakerAnalysis: 講者分析（物件格式，分析各講者的發言特點、參與度、主要觀點等）

請確保回應為有效的JSON格式。
`;

      const result = await model.generateContent(analysisPrompt);
      const response = result.response;
      let analysisText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean and parse JSON response
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let analysis;
      try {
        const parsedAnalysis = JSON.parse(analysisText);
        // Include speaker analysis in the response
        analysis = {
          summary: parsedAnalysis.summary,
          keyTopics: parsedAnalysis.keyTopics,
          actionItems: parsedAnalysis.actionItems,
          highlights: parsedAnalysis.highlights,
          speakerAnalysis: parsedAnalysis.speakerAnalysis
        };
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        // Fallback: create structured analysis from raw text
        analysis = {
          summary: analysisText.substring(0, 200) + "...",
          keyTopics: ["AI分析"],
          actionItems: ["檢視AI分析結果"],
          highlights: [analysisText.substring(0, 100) + "..."]
        };
      }

      // Update transcription with AI analysis results
      console.log('[AI Analysis] 儲存分析結果:', {
        summary: analysis.summary?.length || 0,
        keyTopics: analysis.keyTopics?.length || 0,
        actionItems: analysis.actionItems?.length || 0,
        highlights: analysis.highlights?.length || 0
      });

      await storage.updateTranscription(transcriptionId, {
        summary: analysis.summary || null,
        topicsDetection: analysis.keyTopics || null,
        autoHighlights: analysis.highlights || null,
        actionItems: analysis.actionItems || null,
        speakerAnalysis: analysis.speakerAnalysis || null
      });

      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'gemini_content_analysis_completed',
        description: `轉錄${transcriptionId}完成AI智能分析`,
        details: {
          transcriptionId,
          analysisFeatures: Object.keys(analysis),
          summaryLength: analysis.summary?.length || 0,
          topicsCount: analysis.keyTopics?.length || 0,
          actionItemsCount: analysis.actionItems?.length || 0
        }
      });

      res.json({
        success: true,
        message: "AI分析完成",
        analysis
      });

    } catch (error) {
      console.error("AI Analysis error:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'gemini_analysis_error',
        description: `轉錄${req.params.id}AI分析失敗`,
        severity: 'high',
        details: { error: errMsg }
      });

      res.status(500).json({ message: "AI分析失敗，請稍後再試" });
    }
  });

  // AI transcript cleanup and enhancement with multimodal speaker identification
  app.post("/api/transcriptions/:id/ai-cleanup", requireAuth, async (req: AuthenticatedRequest, res) => {
    const transcriptionId = parseInt(req.params.id);
    let gcsUri: string | null = null;
    const analyzer = new GeminiAnalyzer();

    try {
      const { attendees, useMultimodal = true } = req.body; // 接收與會者名單和是否使用多模態
      const transcription = await storage.getTranscription(transcriptionId);

      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        return res.status(403).json({ message: "無權限執行此操作" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行AI整理" });
      }

      if (!transcription.segments || !Array.isArray(transcription.segments)) {
        return res.status(400).json({ message: "缺少分段資料，無法進行整理" });
      }

      console.log(`[AI Cleanup] 開始處理轉錄 ${transcriptionId}`);
      console.log(`[AI Cleanup] 與會者名單:`, attendees);
      console.log(`[AI Cleanup] 使用多模態分析: ${useMultimodal}`);

      const segments = transcription.segments as any[];
      const originalText = transcription.transcriptText ||
        segments.map(seg => `${seg.speaker}: ${seg.text}`).join('\n');

      let cleanedSegments: any[] = [];
      let speakers: any[] = [];
      let usedMultimodal = false;

      // 嘗試使用多模態分析（如果有音檔且啟用）
      console.log(`[AI Cleanup] useMultimodal: ${useMultimodal}, filename: ${transcription.filename}`);
      if (useMultimodal && transcription.filename) {
        const audioFilePath = path.join(process.cwd(), 'uploads', transcription.filename);
        console.log(`[AI Cleanup] 檢查音檔路徑: ${audioFilePath}`);
        console.log(`[AI Cleanup] 音檔存在檢查: ${nodeFs.existsSync(audioFilePath)}`);

        // 檢查音檔是否存在
        if (nodeFs.existsSync(audioFilePath)) {
          console.log(`[AI Cleanup] 音檔存在: ${audioFilePath}`);

          try {
            // 1. 上傳音檔到 GCS
            console.log(`[AI Cleanup] 上傳音檔到 GCS...`);
            gcsUri = await analyzer.uploadAudioToGCS(audioFilePath);
            console.log(`[AI Cleanup] GCS URI: ${gcsUri}`);

            await AdminLogger.log({
              category: 'multimodal_analysis',
              action: 'gcs_upload_success',
              description: `轉錄${transcriptionId}音檔上傳GCS成功`,
              details: { transcriptionId, gcsUri }
            });

            // 2. 使用 Gemini 1.5 Pro 多模態分析
            console.log(`[AI Cleanup] 開始 Gemini 1.5 Pro 多模態分析...`);
            const multimodalResult = await analyzer.identifySpeakersMultimodal(
              gcsUri,
              originalText,
              attendees
            );

            cleanedSegments = multimodalResult.cleanedSegments;
            speakers = multimodalResult.speakers;
            usedMultimodal = true;

            console.log(`[AI Cleanup] 多模態分析完成: ${cleanedSegments.length} 段落，${speakers.length} 位說話者`);

            await AdminLogger.log({
              category: 'multimodal_analysis',
              action: 'gemini_multimodal_success',
              description: `轉錄${transcriptionId}多模態語者識別成功`,
              details: {
                transcriptionId,
                segmentsCount: cleanedSegments.length,
                speakersCount: speakers.length,
                attendees
              }
            });

          } catch (multimodalError: any) {
            console.error(`[AI Cleanup] 多模態分析失敗:`, multimodalError);

            // 判斷錯誤類型並記錄
            let errorAction = 'gemini_multimodal_error';
            let userMessage = 'AI 分析服務暫時無法使用';

            if (multimodalError.message?.includes('upload') || multimodalError.message?.includes('GCS')) {
              errorAction = 'gcs_upload_error';
              userMessage = '音檔上傳失敗，已改用純文字分析';
            } else if (multimodalError.message?.includes('JSON') || multimodalError.message?.includes('解析')) {
              errorAction = 'gemini_parse_error';
              userMessage = 'AI 回應格式異常，已改用備用方案';
            } else if (multimodalError.message?.includes('timeout') || multimodalError.message?.includes('超時')) {
              errorAction = 'timeout_error';
              userMessage = '分析超時，已改用純文字分析';
            }

            await AdminLogger.log({
              category: 'multimodal_analysis',
              action: errorAction,
              description: `轉錄${transcriptionId}多模態分析失敗: ${multimodalError.message}`,
              severity: 'high',
              details: {
                transcriptionId,
                gcsUri,
                errorType: multimodalError.name,
                errorMessage: multimodalError.message,
                attendees
              }
            });

            // 多模態失敗，fallback 到純文字分析
            console.log(`[AI Cleanup] Fallback 到純文字分析...`);
          }
        } else {
          console.log(`[AI Cleanup] 音檔不存在，使用純文字分析: ${audioFilePath}`);
        }
      }

      // 如果多模態分析失敗或未使用，使用純文字分析
      if (cleanedSegments.length === 0) {
        console.log(`[AI Cleanup] 使用純文字分析模式...`);

        const model = getVertexAIModel();
        const speakerSet = new Set<string>();

        // 分段處理長文本
        const CHUNK_SIZE = 5000;
        const textChunks: string[] = [];
        for (let i = 0; i < originalText.length; i += CHUNK_SIZE) {
          textChunks.push(originalText.substring(i, i + CHUNK_SIZE));
        }

        const attendeesList = attendees && attendees.length > 0
          ? attendees.map((name: string, i: number) => `${i + 1}. ${name}`).join('\n')
          : null;

        for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
          const chunk = textChunks[chunkIndex];

          const cleanupPrompt = `
你是一個專業的語音轉錄整理助手。請完成以下任務：

${attendeesList ? `**與會者名單：**
${attendeesList}

**任務 1：說話者識別**
根據與會者名單，分析對話內容，識別每段話是誰說的。
- 使用與會者的實際姓名（如「${attendees[0]}」）
- 根據語氣、用詞、問答模式來判斷說話者
- 如果無法確定是哪位與會者，請用「未知講者」標記` : `**任務 1：說話者識別**
分析對話內容，根據語氣、用詞、問答模式識別不同的說話者。
- 如果明顯有多人對話，標記為「講者A」、「講者B」等
- 如果只有一人獨白，全部標記為「講者A」
- 最多識別 6 位說話者`}

**任務 2：文字整理**
- 修正語法錯誤和錯別字
- 移除重複用詞和口語贅詞（如「嗯」、「啊」、「那個」）
- 添加適當的標點符號
- 保持原意不變

**原始逐字稿（第 ${chunkIndex + 1}/${textChunks.length} 段）：**
${chunk}

**請直接回應整理後的文字，格式為：**
${attendeesList ? `${attendees[0]}：整理後的內容
${attendees[1] || '其他與會者'}：整理後的內容` : `講者A：整理後的內容
講者B：整理後的內容`}
...

不要回應 JSON，直接用上述格式回應。`;

          try {
            const result = await model.generateContent(cleanupPrompt);
            const response = result.response;
            const cleanedText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const lines = cleanedText.split('\n').filter((line: string) => line.trim());

            for (const line of lines) {
              const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
              if (match) {
                const speaker = match[1].trim();
                const text = match[2].trim();

                if (text.length > 0 && !speaker.includes('任務') && !speaker.includes('原始') && !speaker.includes('整理')) {
                  speakerSet.add(speaker);
                  cleanedSegments.push({
                    text: text,
                    speaker: speaker,
                    start: 0,
                    end: 0,
                    confidence: 0.9
                  });
                }
              }
            }
          } catch (chunkError) {
            console.error(`[AI Cleanup] 第 ${chunkIndex + 1} 段處理失敗:`, chunkError);
          }
        }

        // 建立說話者列表
        const speakerColors = [
          "hsl(220, 70%, 50%)",
          "hsl(120, 70%, 50%)",
          "hsl(0, 70%, 50%)",
          "hsl(280, 70%, 50%)",
          "hsl(60, 70%, 50%)",
          "hsl(180, 70%, 50%)",
        ];

        const speakerList = Array.from(speakerSet).sort();
        speakers = speakerList.map((label, index) => ({
          id: String.fromCharCode(65 + index),
          label,
          color: speakerColors[index % speakerColors.length]
        }));
      }

      // 分配時間戳（如果需要）
      if (cleanedSegments.length > 0 && segments.length > 0) {
        const totalDuration = segments[segments.length - 1]?.end || 30000;

        // 如果 cleanedSegments 沒有時間戳，分配時間
        if (cleanedSegments[0]?.start === 0 && cleanedSegments[0]?.end === 0) {
          const avgDuration = totalDuration / cleanedSegments.length;
          cleanedSegments = cleanedSegments.map((seg: any, index: number) => ({
            ...seg,
            start: Math.floor(index * avgDuration),
            end: Math.floor((index + 1) * avgDuration)
          }));
        }
      }

      // 如果解析失敗，保留原始段落
      const finalSegments = cleanedSegments.length > 0 ? cleanedSegments : segments;

      // Update transcript text with cleaned segments
      const cleanedTranscriptText = finalSegments
        .map((seg: any) => `${seg.speaker}: ${seg.text}`)
        .join('\n');

      // Save cleaned content to database
      await storage.updateTranscription(transcriptionId, {
        cleanedSegments: finalSegments,
        cleanedTranscriptText: cleanedTranscriptText,
        speakers: speakers.length > 0 ? speakers : undefined,
      });

      await AdminLogger.log({
        category: 'ai_cleanup',
        action: 'transcript_cleanup_completed',
        description: `轉錄${transcriptionId}完成AI逐字稿整理${usedMultimodal ? '(多模態)' : '(純文字)'}`,
        details: {
          transcriptionId,
          originalSegments: segments.length,
          cleanedSegments: finalSegments.length,
          speakersIdentified: speakers.length,
          usedMultimodal,
          attendees
        }
      });

      res.json({
        success: true,
        message: usedMultimodal ? "多模態語者識別完成" : "逐字稿整理完成",
        cleanedSegments: finalSegments.length,
        speakers: speakers,
        usedMultimodal,
        transcription: await storage.getTranscription(transcriptionId)
      });

    } catch (error: any) {
      console.error("AI cleanup error:", error);

      await AdminLogger.log({
        category: 'ai_cleanup',
        action: 'transcript_cleanup_error',
        description: `轉錄${transcriptionId}AI逐字稿整理失敗: ${error.message}`,
        severity: 'high',
        details: {
          transcriptionId,
          error: error.message,
          stack: error.stack
        }
      });

      res.status(500).json({ message: error.message || "逐字稿整理失敗，請稍後再試" });

    } finally {
      // 清理 GCS 檔案
      if (gcsUri) {
        try {
          await analyzer.cleanupGCSFilePublic(gcsUri);
          console.log(`[AI Cleanup] GCS 檔案已清理: ${gcsUri}`);
        } catch (cleanupError) {
          console.error(`[AI Cleanup] GCS 清理失敗:`, cleanupError);
          await AdminLogger.log({
            category: 'multimodal_analysis',
            action: 'gcs_cleanup_error',
            description: `轉錄${transcriptionId}GCS檔案清理失敗`,
            severity: 'low',
            details: { transcriptionId, gcsUri, error: (cleanupError as Error).message }
          });
        }
      }
    }
  });

  // Unified AI Analysis with SSE progress updates
  // 統一 AI 分析端點 - 結合多模態語者識別 + AI 內容分析
  app.post("/api/transcriptions/:id/unified-analysis", requireAuth, async (req: AuthenticatedRequest, res) => {
    const transcriptionId = parseInt(req.params.id);
    let gcsUri: string | null = null;
    const analyzer = new GeminiAnalyzer();

    // 設定 SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 發送 SSE 進度訊息的輔助函式
    const sendProgress = (stage: string, progress: number, message: string, data?: any) => {
      const event = { stage, progress, message, data };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const { attendees, attendeeRoles } = req.body;
      // attendees: string[] - 與會者名單
      // attendeeRoles: string - 角色描述（如「陳經理通常是主持會議的人，林秘書負責記錄並偶爾補充」）

      const transcription = await storage.getTranscription(transcriptionId);

      if (!transcription) {
        sendProgress('error', 0, '轉錄記錄不存在');
        return res.end();
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        sendProgress('error', 0, '無權限執行此操作');
        return res.end();
      }

      if (transcription.status !== 'completed') {
        sendProgress('error', 0, '轉錄尚未完成，無法進行AI分析');
        return res.end();
      }

      if (!transcription.segments || !Array.isArray(transcription.segments)) {
        sendProgress('error', 0, '缺少分段資料，無法進行分析');
        return res.end();
      }

      console.log(`[Unified Analysis] 開始處理轉錄 ${transcriptionId}`);
      console.log(`[Unified Analysis] 與會者名單:`, attendees);
      console.log(`[Unified Analysis] 角色描述:`, attendeeRoles);

      const segments = transcription.segments as any[];
      const originalText = transcription.transcriptText ||
        segments.map(seg => `${seg.speaker}: ${seg.text}`).join('\n');

      let cleanedSegments: any[] = [];
      let speakers: any[] = [];
      let usedMultimodal = false;

      // ====== 階段 1: 多模態語者識別 ======
      sendProgress('uploading', 10, '正在準備音檔上傳...');

      if (transcription.filename) {
        const audioFilePath = path.join(process.cwd(), 'uploads', transcription.filename);

        if (nodeFs.existsSync(audioFilePath)) {
          try {
            // 1. 上傳音檔到 GCS
            sendProgress('uploading', 20, '正在上傳音檔至雲端...');
            gcsUri = await analyzer.uploadAudioToGCS(audioFilePath);
            console.log(`[Unified Analysis] GCS URI: ${gcsUri}`);

            sendProgress('speaker_identification', 40, '正在進行多模態語者識別...');

            await AdminLogger.log({
              category: 'unified_analysis',
              action: 'gcs_upload_success',
              description: `轉錄${transcriptionId}統一分析：音檔上傳GCS成功`,
              details: { transcriptionId, gcsUri }
            });

            // 2. 使用 Gemini 1.5 Pro 多模態分析（加入角色定義）
            console.log(`[Unified Analysis] 開始 Gemini 1.5 Pro 多模態分析...`);
            const multimodalResult = await analyzer.identifySpeakersMultimodal(
              gcsUri,
              originalText,
              attendees,
              attendeeRoles // 傳入角色描述
            );

            cleanedSegments = multimodalResult.cleanedSegments;
            speakers = multimodalResult.speakers;
            usedMultimodal = true;

            sendProgress('speaker_identification', 60, `已識別 ${speakers.length} 位語者，共 ${cleanedSegments.length} 段對話`);

            console.log(`[Unified Analysis] 多模態分析完成: ${cleanedSegments.length} 段落，${speakers.length} 位說話者`);

            await AdminLogger.log({
              category: 'unified_analysis',
              action: 'multimodal_speaker_identification_success',
              description: `轉錄${transcriptionId}多模態語者識別成功`,
              details: {
                transcriptionId,
                segmentsCount: cleanedSegments.length,
                speakersCount: speakers.length,
                attendees,
                attendeeRoles
              }
            });

          } catch (multimodalError: any) {
            console.error(`[Unified Analysis] 多模態分析失敗:`, multimodalError);

            sendProgress('speaker_identification', 45, '多模態分析失敗，正在使用純文字分析...');

            await AdminLogger.log({
              category: 'unified_analysis',
              action: 'multimodal_fallback',
              description: `轉錄${transcriptionId}多模態分析失敗，切換到純文字分析: ${multimodalError.message}`,
              severity: 'medium',
              details: {
                transcriptionId,
                gcsUri,
                errorMessage: multimodalError.message,
                attendees
              }
            });
          }
        } else {
          sendProgress('speaker_identification', 30, '音檔不存在，使用純文字分析...');
        }
      } else {
        sendProgress('speaker_identification', 30, '無音檔資訊，使用純文字分析...');
      }

      // 如果多模態失敗，使用純文字分析
      if (cleanedSegments.length === 0) {
        sendProgress('speaker_identification', 50, '正在進行純文字語者識別...');

        const model = getVertexAIModel();
        const speakerSet = new Set<string>();

        const CHUNK_SIZE = 5000;
        const textChunks: string[] = [];
        for (let i = 0; i < originalText.length; i += CHUNK_SIZE) {
          textChunks.push(originalText.substring(i, i + CHUNK_SIZE));
        }

        const attendeesList = attendees && attendees.length > 0
          ? attendees.map((name: string, i: number) => `${i + 1}. ${name}`).join('\n')
          : null;

        // 加入角色描述到 prompt
        const roleContext = attendeeRoles
          ? `\n**角色背景資訊：**\n${attendeeRoles}\n`
          : '';

        for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
          const chunk = textChunks[chunkIndex];

          const cleanupPrompt = `
你是一個專業的語音轉錄整理助手。請完成以下任務：

${attendeesList ? `**與會者名單：**
${attendeesList}
${roleContext}
**任務 1：說話者識別**
根據與會者名單和角色背景，分析對話內容，識別每段話是誰說的。
- 使用與會者的實際姓名（如「${attendees[0]}」）
- 根據語氣、用詞、問答模式以及角色定義來判斷說話者
- 如果無法確定是哪位與會者，請用「未知講者」標記` : `**任務 1：說話者識別**
分析對話內容，根據語氣、用詞、問答模式識別不同的說話者。
- 如果明顯有多人對話，標記為「講者A」、「講者B」等
- 如果只有一人獨白，全部標記為「講者A」
- 最多識別 6 位說話者`}

**任務 2：文字整理**
- 修正語法錯誤和錯別字
- 移除重複用詞和口語贅詞（如「嗯」、「啊」、「那個」）
- 添加適當的標點符號
- 保持原意不變

**原始逐字稿（第 ${chunkIndex + 1}/${textChunks.length} 段）：**
${chunk}

**請直接回應整理後的文字，格式為：**
${attendeesList ? `${attendees[0]}：整理後的內容
${attendees[1] || '其他與會者'}：整理後的內容` : `講者A：整理後的內容
講者B：整理後的內容`}
...

不要回應 JSON，直接用上述格式回應。`;

          try {
            const result = await model.generateContent(cleanupPrompt);
            const response = result.response;
            const cleanedText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

            const lines = cleanedText.split('\n').filter((line: string) => line.trim());

            for (const line of lines) {
              const match = line.match(/^([^：:]+)[：:]\s*(.+)$/);
              if (match) {
                const speaker = match[1].trim();
                const text = match[2].trim();

                if (text.length > 0 && !speaker.includes('任務') && !speaker.includes('原始') && !speaker.includes('整理')) {
                  speakerSet.add(speaker);
                  cleanedSegments.push({
                    text: text,
                    speaker: speaker,
                    start: 0,
                    end: 0,
                    confidence: 0.85
                  });
                }
              }
            }
          } catch (chunkError) {
            console.error(`[Unified Analysis] 第 ${chunkIndex + 1} 段處理失敗:`, chunkError);
          }
        }

        // 建立說話者列表
        const speakerColors = [
          "hsl(220, 70%, 50%)",
          "hsl(120, 70%, 50%)",
          "hsl(0, 70%, 50%)",
          "hsl(280, 70%, 50%)",
          "hsl(60, 70%, 50%)",
          "hsl(180, 70%, 50%)",
        ];

        const speakerList = Array.from(speakerSet).sort();
        speakers = speakerList.map((label, index) => ({
          id: String.fromCharCode(65 + index),
          label,
          color: speakerColors[index % speakerColors.length]
        }));
      }

      // 分配時間戳
      if (cleanedSegments.length > 0 && segments.length > 0) {
        const totalDuration = segments[segments.length - 1]?.end || 30000;

        if (cleanedSegments[0]?.start === 0 && cleanedSegments[0]?.end === 0) {
          const avgDuration = totalDuration / cleanedSegments.length;
          cleanedSegments = cleanedSegments.map((seg: any, index: number) => ({
            ...seg,
            start: Math.floor(index * avgDuration),
            end: Math.floor((index + 1) * avgDuration)
          }));
        }
      }

      const finalSegments = cleanedSegments.length > 0 ? cleanedSegments : segments;

      // 更新 cleanedSegments 和 speakers 到資料庫
      const cleanedTranscriptText = finalSegments
        .map((seg: any) => `${seg.speaker}: ${seg.text}`)
        .join('\n');

      await storage.updateTranscription(transcriptionId, {
        cleanedSegments: finalSegments,
        cleanedTranscriptText: cleanedTranscriptText,
        speakers: speakers.length > 0 ? speakers : undefined,
      });

      // ====== 階段 2: AI 內容分析 ======
      sendProgress('content_analysis', 70, '正在進行 AI 內容分析...');

      const model = getVertexAIModel();

      // 使用整理後的逐字稿進行分析
      const textForAnalysis = cleanedTranscriptText || originalText;

      const analysisPrompt = `
你是一個專業的會議記錄分析師。請分析以下會議逐字稿，提煉出重要資訊。請用繁體中文回應，格式為嚴格的JSON：

${textForAnalysis.substring(0, 15000)}

請提供完整的分析，包含以下所有欄位：
{
  "summary": "會議整體摘要，200-300字，包含主要討論內容和結論",
  "actionItems": [
    {
      "content": "待辦事項具體描述",
      "type": "todo",
      "assignee": "負責人（如果有的話）",
      "priority": "high/medium/low",
      "dueDate": "截止日期（如果有提到）"
    }
  ],
  "speakerAnalysis": {
    "講者名稱": {
      "參與度": "高/中/低",
      "發言特點": "此人的發言風格和特點",
      "主要觀點": "此人主要提出的觀點或貢獻"
    }
  },
  "topicsDetection": ["主題1", "主題2", "主題3"],
  "autoHighlights": ["重要內容摘錄1", "重要內容摘錄2"]
}

重要：請只回傳純JSON格式，不要使用 markdown code block，不要有任何其他文字說明。`;

      let analysisResult: any = {};

      try {
        sendProgress('content_analysis', 80, '正在生成會議摘要和行動項目...');

        const result = await model.generateContent(analysisPrompt);
        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        // 清理並解析 JSON
        let cleanJson = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        try {
          analysisResult = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error('[Unified Analysis] JSON 解析失敗，嘗試修復:', parseError);
          // 嘗試提取 JSON 部分
          const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisResult = JSON.parse(jsonMatch[0]);
          }
        }

        console.log(`[Unified Analysis] AI 分析完成`);

      } catch (analysisError: any) {
        console.error('[Unified Analysis] AI 分析失敗:', analysisError);

        await AdminLogger.log({
          category: 'unified_analysis',
          action: 'content_analysis_error',
          description: `轉錄${transcriptionId}內容分析失敗: ${analysisError.message}`,
          severity: 'medium',
          details: { transcriptionId, errorMessage: analysisError.message }
        });

        // 即使分析失敗，也繼續（語者識別已完成）
        analysisResult = {
          summary: '內容分析處理中發生錯誤，請稍後重試',
          actionItems: [],
          topicsDetection: [],
          autoHighlights: []
        };
      }

      // 更新分析結果到資料庫
      await storage.updateTranscription(transcriptionId, {
        summary: analysisResult.summary,
        actionItems: analysisResult.actionItems || [],
        speakerAnalysis: analysisResult.speakerAnalysis,
        topicsDetection: analysisResult.topicsDetection || [],
        autoHighlights: analysisResult.autoHighlights || [],
      });

      sendProgress('completed', 100, '分析完成', {
        speakersCount: speakers.length,
        segmentsCount: finalSegments.length,
        usedMultimodal,
        hasActionItems: (analysisResult.actionItems?.length || 0) > 0,
        hasSummary: !!analysisResult.summary
      });

      await AdminLogger.log({
        category: 'unified_analysis',
        action: 'unified_analysis_completed',
        description: `轉錄${transcriptionId}統一AI分析完成`,
        details: {
          transcriptionId,
          usedMultimodal,
          speakersCount: speakers.length,
          segmentsCount: finalSegments.length,
          hasAnalysis: !!analysisResult.summary
        }
      });

      res.end();

    } catch (error: any) {
      console.error("[Unified Analysis] 統一分析錯誤:", error);

      await AdminLogger.log({
        category: 'unified_analysis',
        action: 'unified_analysis_error',
        description: `轉錄${transcriptionId}統一AI分析失敗: ${error.message}`,
        severity: 'high',
        details: {
          transcriptionId,
          error: error.message,
          stack: error.stack
        }
      });

      sendProgress('error', 0, error.message || '分析過程中發生錯誤');
      res.end();

    } finally {
      // 清理 GCS 檔案
      if (gcsUri) {
        try {
          await analyzer.cleanupGCSFilePublic(gcsUri);
          console.log(`[Unified Analysis] GCS 檔案已清理: ${gcsUri}`);
        } catch (cleanupError) {
          console.error(`[Unified Analysis] GCS 清理失敗:`, cleanupError);
        }
      }
    }
  });

  // Comprehensive Gemini AI Analysis
  app.post("/api/transcriptions/:id/gemini-analysis", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const { analysisType } = req.body; // 'summary', 'speaker', 'sentiment', 'keywords', 'all'
      
      const transcription = await storage.getTranscription(transcriptionId);
      
      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行AI分析" });
      }

      // Use Vertex AI for Gemini analysis (ADC 認證)
      const model = getVertexAIModel();

      const segments = transcription.segments as any[];
      const originalText = transcription.transcriptText || 
        segments.map(seg => `${seg.speaker}: ${seg.text}`).join('\n');

      let analysisResults: any = {};

      // Meeting Summary and Key Points
      if (analysisType === 'summary' || analysisType === 'all') {
        const summaryPrompt = `
請分析以下會議逐字稿，提煉出重要資訊。請用繁體中文回應，格式為JSON：

${originalText}

請提供以下分析：
{
  "meetingSummary": "會議整體摘要，包含主要討論內容",
  "keyPoints": ["重點1", "重點2", "重點3"],
  "keyDecisions": ["決議1", "決議2"],
  "actionItems": [
    {"task": "任務描述", "assignee": "負責人", "deadline": "期限"},
    {"task": "任務描述", "assignee": "負責人", "deadline": "期限"}
  ],
  "meetingStructure": {
    "openingTopic": "開場主題",
    "mainDiscussions": ["討論點1", "討論點2"],
    "conclusions": "結論"
  }
}

請只回傳JSON格式，不要其他解釋。
`;

        try {
          const summaryResult = await model.generateContent(summaryPrompt);
          const summaryResponse = summaryResult.response;
          const summaryText = summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const summaryData = JSON.parse(summaryText.replace(/```json\n?|\n?```/g, ''));
          
          analysisResults = {
            ...analysisResults,
            summary: summaryData.meetingSummary,
            keyDecisions: summaryData.keyDecisions,
            actionItems: summaryData.actionItems,
            meetingStructure: summaryData.meetingStructure,
            keyPoints: summaryData.keyPoints
          };
        } catch (error) {
          console.error("Summary analysis error:", error);
        }
      }

      // Speaker Analysis
      if (analysisType === 'speaker' || analysisType === 'all') {
        const speakerPrompt = `
請分析以下會議逐字稿中的講者特徵。請用繁體中文回應，格式為JSON：

${originalText}

請分析每位講者的特徵：
{
  "speakerAnalysis": {
    "講者 A": {
      "role": "角色推測（如：主持人、參與者、專家等）",
      "speakingStyle": "說話風格描述",
      "keyContributions": ["主要貢獻1", "主要貢獻2"],
      "talkTime": "發言時間比例估計"
    }
  },
  "speakerInteraction": "講者互動模式描述"
}

請只回傳JSON格式，不要其他解釋。
`;

        try {
          const speakerResult = await model.generateContent(speakerPrompt);
          const speakerResponse = speakerResult.response;
          const speakerText = speakerResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const speakerData = JSON.parse(speakerText.replace(/```json\n?|\n?```/g, ''));
          
          analysisResults = {
            ...analysisResults,
            speakerAnalysis: speakerData.speakerAnalysis,
            speakerInteraction: speakerData.speakerInteraction
          };
        } catch (error) {
          console.error("Speaker analysis error:", error);
        }
      }

      // Sentiment Analysis
      if (analysisType === 'sentiment' || analysisType === 'all') {
        const sentimentPrompt = `
請分析以下會議逐字稿的情緒和語氣。請用繁體中文回應，格式為JSON：

${originalText}

請分析情緒和語氣：
{
  "overallSentiment": {
    "tone": "整體語氣（正面/中性/負面）",
    "mood": "會議氛圍描述",
    "confidence": 0.85
  },
  "speakerSentiments": {
    "講者 A": {
      "dominantEmotion": "主要情緒",
      "emotionalVariations": ["情緒變化1", "情緒變化2"],
      "conflictLevel": "衝突程度（低/中/高）"
    }
  },
  "emotionalHighlights": [
    {"timeframe": "時間段", "emotion": "情緒", "description": "描述"}
  ]
}

請只回傳JSON格式，不要其他解釋。
`;

        try {
          const sentimentResult = await model.generateContent(sentimentPrompt);
          const sentimentResponse = sentimentResult.response;
          const sentimentText = sentimentResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const sentimentData = JSON.parse(sentimentText.replace(/```json\n?|\n?```/g, ''));
          
          analysisResults = {
            ...analysisResults,
            sentimentAnalysis: sentimentData
          };
        } catch (error) {
          console.error("Sentiment analysis error:", error);
        }
      }

      // Keyword Extraction
      if (analysisType === 'keywords' || analysisType === 'all') {
        const keywordPrompt = `
請從以下會議逐字稿中提取關鍵資訊。請用繁體中文回應，格式為JSON：

${originalText}

請提取關鍵資訊：
{
  "keyTopics": [
    {"topic": "主題名稱", "importance": "高/中/低", "mentions": 5}
  ],
  "keywordExtraction": {
    "importantTerms": ["關鍵詞1", "關鍵詞2"],
    "technicalTerms": ["技術詞彙1", "技術詞彙2"],
    "peopleNames": ["人名1", "人名2"],
    "organizationNames": ["組織名1", "組織名2"],
    "locations": ["地點1", "地點2"],
    "dates": ["日期1", "日期2"]
  },
  "topicProgression": [
    {"sequence": 1, "topic": "開場主題", "duration": "估計時長"}
  ]
}

請只回傳JSON格式，不要其他解釋。
`;

        try {
          const keywordResult = await model.generateContent(keywordPrompt);
          const keywordResponse = keywordResult.response;
          const keywordText = keywordResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const keywordData = JSON.parse(keywordText.replace(/```json\n?|\n?```/g, ''));
          
          analysisResults = {
            ...analysisResults,
            keyTopics: keywordData.keyTopics,
            keywordExtraction: keywordData.keywordExtraction,
            topicProgression: keywordData.topicProgression
          };
        } catch (error) {
          console.error("Keyword analysis error:", error);
        }
      }

      // Update transcription with analysis results
      await storage.updateTranscription(transcriptionId, analysisResults);

      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'gemini_analysis_completed',
        description: `轉錄${transcriptionId}完成Gemini AI分析`,
        details: {
          transcriptionId,
          analysisType,
          analysisComponents: Object.keys(analysisResults)
        }
      });

      res.json({
        success: true,
        message: "AI分析完成",
        analysisType,
        results: analysisResults,
        transcription: await storage.getTranscription(transcriptionId)
      });

    } catch (error) {
      console.error("Gemini analysis error:", error);
      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'gemini_analysis_error',
        description: `轉錄${req.params.id} Gemini AI分析失敗`,
        severity: 'high',
        details: { error: (error as Error).message }
      });
      
      res.status(500).json({ message: "AI分析失敗，請稍後再試" });
    }
  });

  // Update speaker labels
  app.patch("/api/transcriptions/:id/speakers", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const { speakers } = req.body;
      
      if (!Array.isArray(speakers)) {
        return res.status(400).json({ message: "講者資料格式錯誤" });
      }

      const transcription = await storage.getTranscription(transcriptionId);
      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        return res.status(403).json({ message: "無權限執行此操作" });
      }

      // Update speakers and also update all segments with new speaker names
      const updatedTranscription = await storage.updateTranscription(transcriptionId, {
        speakers: speakers
      });

      // Also update segments to reflect new speaker names
      if (transcription.segments) {
        const segments = JSON.parse(JSON.stringify(transcription.segments));
        const oldSpeakers = transcription.speakers as any[];
        
        const updatedSegments = segments.map((segment: any) => {
          // Find the speaker in the old speakers array
          let speakerIndex = -1;
          if (oldSpeakers) {
            speakerIndex = oldSpeakers.findIndex((speaker: any) => {
              if (typeof speaker === 'string') {
                return speaker === segment.speaker;
              } else {
                return speaker.id === segment.speaker || speaker.label === segment.speaker;
              }
            });
          }
          
          // Update the segment with the new speaker name
          if (speakerIndex !== -1 && speakerIndex < speakers.length) {
            return { ...segment, speaker: speakers[speakerIndex] };
          }
          return segment;
        });

        await storage.updateTranscription(transcriptionId, {
          segments: updatedSegments
        });
      }

      await AdminLogger.log({
        category: 'speaker_management',
        action: 'update_speaker_labels',
        description: `更新轉錄${transcriptionId}的講者標籤`,
        details: {
          transcriptionId,
          oldSpeakers: transcription.speakers,
          newSpeakers: speakers
        }
      });

      res.json({
        success: true,
        message: "講者標籤已更新",
        transcription: updatedTranscription
      });

    } catch (error) {
      console.error("Speaker update error:", error);
      res.status(500).json({ message: "更新講者標籤失敗" });
    }
  });

  // Update single segment speaker (for inline editing)
  app.patch("/api/transcriptions/:id/segments/:segmentIndex/speaker", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const segmentIndex = parseInt(req.params.segmentIndex);
      const { speaker } = req.body;

      if (!speaker || typeof speaker !== 'string') {
        return res.status(400).json({ message: "請提供有效的語者名稱" });
      }

      const transcription = await storage.getTranscription(transcriptionId);
      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        return res.status(403).json({ message: "無權限執行此操作" });
      }

      // Update cleanedSegments
      const cleanedSegments = [...(transcription.cleanedSegments as any[] || [])];
      if (segmentIndex < 0 || segmentIndex >= cleanedSegments.length) {
        return res.status(400).json({ message: "無效的段落索引" });
      }

      const oldSpeaker = cleanedSegments[segmentIndex].speaker;
      cleanedSegments[segmentIndex] = { ...cleanedSegments[segmentIndex], speaker };

      await storage.updateTranscription(transcriptionId, { cleanedSegments });

      await AdminLogger.log({
        category: 'speaker_management',
        action: 'update_segment_speaker',
        description: `更新轉錄${transcriptionId}第${segmentIndex + 1}段的語者：${oldSpeaker} → ${speaker}`,
        severity: 'info',
        userId: req.user!.id,
        transcriptionId,
        details: { segmentIndex, oldSpeaker, newSpeaker: speaker }
      });

      res.json({ success: true, message: "語者已更新" });

    } catch (error) {
      console.error("Segment speaker update error:", error);
      res.status(500).json({ message: "更新語者失敗" });
    }
  });

  // Batch update segment speakers
  app.patch("/api/transcriptions/:id/segments/batch-speaker", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const { updates } = req.body;  // [{ segmentIndex: number, speaker: string }]

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "請提供有效的更新資料" });
      }

      const transcription = await storage.getTranscription(transcriptionId);
      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      // Check permissions
      if (req.user!.role !== 'admin' && transcription.userId !== req.user!.id) {
        return res.status(403).json({ message: "無權限執行此操作" });
      }

      // Batch update cleanedSegments
      const cleanedSegments = [...(transcription.cleanedSegments as any[] || [])];
      const updateDetails: any[] = [];

      for (const update of updates) {
        const { segmentIndex, speaker } = update;
        if (segmentIndex >= 0 && segmentIndex < cleanedSegments.length && speaker) {
          const oldSpeaker = cleanedSegments[segmentIndex].speaker;
          cleanedSegments[segmentIndex] = { ...cleanedSegments[segmentIndex], speaker };
          updateDetails.push({ segmentIndex, oldSpeaker, newSpeaker: speaker });
        }
      }

      await storage.updateTranscription(transcriptionId, { cleanedSegments });

      await AdminLogger.log({
        category: 'speaker_management',
        action: 'batch_update_segment_speakers',
        description: `批次更新轉錄${transcriptionId}的${updateDetails.length}段語者`,
        severity: 'info',
        userId: req.user!.id,
        transcriptionId,
        details: { updates: updateDetails }
      });

      res.json({ success: true, updatedCount: updateDetails.length });

    } catch (error) {
      console.error("Batch speaker update error:", error);
      res.status(500).json({ message: "批次更新語者失敗" });
    }
  });

  // Get all transcriptions (user-specific or all for admin)
  app.get("/api/transcriptions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Disable caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      let transcriptions;
      
      // Admin can see all transcriptions, regular users only see their own
      if (req.user!.role === 'admin') {
        transcriptions = await storage.getAllTranscriptions();
      } else {
        transcriptions = await storage.getUserTranscriptions(req.user!.id);
      }
      
      res.json(transcriptions);
    } catch (error) {
      console.error("Failed to get transcriptions:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "獲取轉錄記錄失敗" });
    }
  });

  // Download audio file
  // Support token via query parameter for direct download links
  app.get("/api/transcriptions/:id/download-audio", async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);

      // Try to authenticate from query token, header, or cookie
      let user = null;
      const queryToken = req.query.token as string;
      const headerToken = req.headers.authorization?.replace('Bearer ', '');
      const cookieToken = req.cookies?.auth_token;
      const token = queryToken || headerToken || cookieToken;

      if (token) {
        user = await AuthService.validateSession(token);
      }

      if (!user || user.status !== 'active') {
        return res.status(401).json({ message: "需要登入" });
      }

      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      // Check if user has access to this transcription
      if (user.role !== 'admin' && transcription.userId !== user.id) {
        return res.status(403).json({ message: "無權限下載此檔案" });
      }

      const filePath = path.join(process.cwd(), "uploads", transcription.filename);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (error) {
        return res.status(404).json({ message: "音頻檔案不存在" });
      }

      // Get file stats for Content-Length
      const stats = await fs.stat(filePath);

      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(transcription.originalName || transcription.filename)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', stats.size);

      // Stream the file
      const fileStream = nodeFs.createReadStream(filePath);
      fileStream.pipe(res);

      fileStream.on('error', (error: any) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "檔案讀取失敗" });
        }
      });

    } catch (error) {
      console.error("Audio download error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "下載失敗"
      });
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

      // 優先使用整理後的逐字稿
      const textToAnalyze = (transcription as any).cleanedTranscriptText || transcription.transcriptText;

      if (!textToAnalyze) {
        return res.status(400).json({ message: "缺少轉錄文本，無法進行分析" });
      }

      console.log(`[AI Analysis] 使用${(transcription as any).cleanedTranscriptText ? '整理後' : '原始'}逐字稿進行分析`);

      // Use Vertex AI for analysis (ADC 認證)
      const model = getVertexAIModel();

      const analysisPrompt = `
請對以下中文轉錄內容進行全面的AI智能分析，並以JSON格式回應：

轉錄內容：
${textToAnalyze.substring(0, 15000)}

請提供以下分析結果（請用繁體中文回應）：

1. summary: 內容摘要（200字以內）

2. keyTopics: 關鍵主題和話題（陣列格式，最多10個）

3. actionItems: 重點追蹤事項（陣列格式，每項為物件），請分析並提取：
   - type: 類型，可為 "todo"(待辦)、"decision"(決策)、"commitment"(承諾)、"deadline"(時間節點)、"followup"(追蹤)
   - content: 具體內容描述
   - assignee: 負責人（如有提及）
   - dueDate: 截止日期（如有提及）
   - priority: 優先級 "high"(高)、"medium"(中)、"low"(低)

   範例格式：
   [
     {"type": "todo", "content": "準備下週會議資料", "assignee": "講者A", "priority": "high"},
     {"type": "decision", "content": "確定採用方案B", "priority": "medium"},
     {"type": "deadline", "content": "專案截止日", "dueDate": "下週五", "priority": "high"}
   ]

4. highlights: 重要段落摘錄（陣列格式，最多5個）

5. speakerAnalysis: 講者分析（物件格式，分析各講者的發言特點、參與度、主要觀點等）

請確保回應為有效的JSON格式。
`;

      const result = await model.generateContent(analysisPrompt);
      const response = result.response;
      let analysisText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean and parse JSON response
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let analysis;
      try {
        const parsedAnalysis = JSON.parse(analysisText);
        analysis = {
          summary: parsedAnalysis.summary,
          keyTopics: parsedAnalysis.keyTopics,
          actionItems: parsedAnalysis.actionItems,
          highlights: parsedAnalysis.highlights,
          speakerAnalysis: parsedAnalysis.speakerAnalysis
        };
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        analysis = {
          summary: analysisText.substring(0, 200) + "...",
          keyTopics: ["AI分析"],
          actionItems: [],
          highlights: [analysisText.substring(0, 100) + "..."]
        };
      }

      // Log the analysis results
      console.log('[AI Analysis] 儲存分析結果:', {
        summary: analysis.summary?.length || 0,
        keyTopics: analysis.keyTopics?.length || 0,
        actionItems: analysis.actionItems?.length || 0,
        highlights: analysis.highlights?.length || 0,
        speakerAnalysis: analysis.speakerAnalysis ? Object.keys(analysis.speakerAnalysis).length : 0
      });

      // Save analysis results to database
      await storage.updateTranscription(id, {
        summary: analysis.summary || null,
        topicsDetection: analysis.keyTopics || null,
        actionItems: analysis.actionItems || null,
        autoHighlights: analysis.highlights || null,
        speakerAnalysis: analysis.speakerAnalysis || null,
      });

      // Return updated transcription
      const updatedTranscription = await storage.getTranscription(id);
      res.json(updatedTranscription);
    } catch (error) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "AI 分析失敗"
      });
    }
  });

  // RD Mode Analysis - Generate technical documentation from engineering discussions
  // RD 模式不需要多模態分析，直接使用現有逐字稿產出技術文檔
  app.post("/api/transcriptions/:id/analyze-rd", requireAuth, async (req: AuthenticatedRequest, res) => {
    const id = parseInt(req.params.id);

    try {
      const transcription = await storage.getTranscription(id);

      if (!transcription) {
        return res.status(404).json({ message: "找不到轉錄記錄" });
      }

      if (transcription.status !== 'completed') {
        return res.status(400).json({ message: "轉錄尚未完成，無法進行 RD 分析" });
      }

      // 優先使用整理後的逐字稿，否則使用原始逐字稿
      const textToAnalyze = (transcription as any).cleanedTranscriptText || transcription.transcriptText;

      if (!textToAnalyze) {
        return res.status(400).json({ message: "缺少轉錄文本，無法進行 RD 分析" });
      }

      console.log(`[RD Analysis] 開始 RD 模式分析，使用${(transcription as any).cleanedTranscriptText ? '整理後' : '原始'}逐字稿`);

      // Use Vertex AI for RD analysis
      const model = getVertexAIModel();

      const rdAnalysisPrompt = `
你是一位資深軟體架構師和技術文件專家。
請根據以下 RD 團隊的會議討論內容，產出完整的技術文檔和圖表。

會議記錄內容：
${textToAnalyze.substring(0, 20000)}

===== 輸出要求 =====
請用繁體中文回應，輸出格式為嚴格的 JSON。

===== JSON 結構 =====
{
  "documents": {
    "userStories": [
      {
        "id": "US-001",
        "asA": "作為什麼角色",
        "iWant": "我想要什麼功能",
        "soThat": "以便達成什麼目的",
        "acceptanceCriteria": ["驗收條件1", "驗收條件2"],
        "priority": "high" | "medium" | "low"
      }
    ],
    "requirements": [
      {
        "id": "REQ-001",
        "title": "需求標題",
        "description": "詳細描述",
        "type": "functional" | "non-functional",
        "priority": "must" | "should" | "could" | "wont",
        "relatedUserStories": ["US-001"]
      }
    ],
    "apiDesign": [
      {
        "method": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
        "path": "/api/example",
        "description": "端點說明",
        "requestBody": {
          "contentType": "application/json",
          "schema": {"field": "type"},
          "example": {"field": "value"}
        },
        "responseBody": {
          "statusCode": 200,
          "schema": {"field": "type"},
          "example": {"field": "value"}
        },
        "authentication": "Bearer Token"
      }
    ],
    "systemArchitecture": {
      "overview": "系統架構概述",
      "components": [
        {
          "name": "組件名稱",
          "description": "組件描述",
          "technology": "使用技術",
          "responsibilities": ["職責1", "職責2"]
        }
      ],
      "interactions": [
        {
          "from": "組件A",
          "to": "組件B",
          "description": "交互說明"
        }
      ]
    },
    "databaseDesign": [
      {
        "tableName": "表名",
        "description": "表描述",
        "columns": [
          {
            "name": "欄位名",
            "type": "資料類型",
            "nullable": false,
            "primaryKey": true,
            "foreignKey": {"table": "關聯表", "column": "關聯欄位"},
            "description": "欄位說明"
          }
        ],
        "indexes": ["index_name"]
      }
    ],
    "technicalDecisions": [
      {
        "id": "ADR-001",
        "title": "決策標題",
        "context": "背景說明",
        "decision": "決策內容",
        "consequences": "影響與後果",
        "alternatives": ["替代方案1", "替代方案2"],
        "status": "proposed" | "accepted" | "deprecated"
      }
    ]
  },
  "diagrams": {
    "flowchart": {
      "title": "流程圖標題",
      "description": "圖表描述",
      "code": "flowchart TD\\n    A[開始] --> B[步驟1]\\n    B --> C[結束]"
    },
    "sequenceDiagram": {
      "title": "循序圖標題",
      "description": "圖表描述",
      "code": "sequenceDiagram\\n    participant User\\n    participant Server\\n    User->>Server: 請求\\n    Server-->>User: 回應"
    },
    "erDiagram": {
      "title": "ER 圖標題",
      "description": "圖表描述",
      "code": "erDiagram\\n    USER ||--o{ ORDER : places\\n    USER {\\n        int id PK\\n        string name\\n    }"
    },
    "stateDiagram": null,
    "c4Diagram": null
  },
  "metadata": {
    "projectName": "專案名稱（如有提及）",
    "discussionDate": "${new Date().toISOString().split('T')[0]}",
    "participants": ["參與者1", "參與者2"],
    "summary": "討論摘要（100字以內）"
  }
}

===== Mermaid 圖表規則 =====
1. 使用 \\n 表示換行（不是實際換行）
2. 中文文字用引號包裹，例如 A["開始處理"]
3. 未討論到的圖表設為 null
4. 圖表元素不超過 15 個節點
5. 確保語法正確可渲染

===== 重要注意事項 =====
1. 只提取明確討論的內容，不要憑空捏造
2. 如果某類文檔沒有相關討論，設為空陣列 []
3. 優先產出最相關的文檔類型
4. API 設計需符合 RESTful 規範
5. 資料庫設計需考慮正規化
6. 各類型文檔數量適中（3-10 項）

請確保回應為有效的 JSON 格式，不要包含任何 markdown 標記或解釋文字。
`;

      const result = await model.generateContent(rdAnalysisPrompt);
      const response = result.response;
      let analysisText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean JSON response
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let rdAnalysis: {
        documents: {
          userStories: unknown[];
          requirements: unknown[];
          apiDesign: unknown[];
          systemArchitecture: { overview: string; components: unknown[]; interactions: unknown[] };
          databaseDesign: unknown[];
          technicalDecisions: unknown[];
        };
        diagrams: Record<string, unknown>;
        metadata: { discussionDate: string; participants: string[]; summary: string; projectName?: string };
      };
      try {
        const parsed = JSON.parse(analysisText);

        // Build validated structure with defaults
        rdAnalysis = {
          documents: {
            userStories: parsed.documents?.userStories || [],
            requirements: parsed.documents?.requirements || [],
            apiDesign: parsed.documents?.apiDesign || [],
            systemArchitecture: parsed.documents?.systemArchitecture || { overview: '', components: [], interactions: [] },
            databaseDesign: parsed.documents?.databaseDesign || [],
            technicalDecisions: parsed.documents?.technicalDecisions || []
          },
          diagrams: parsed.diagrams || {},
          metadata: {
            discussionDate: parsed.metadata?.discussionDate || new Date().toISOString().split('T')[0],
            participants: parsed.metadata?.participants || [],
            summary: parsed.metadata?.summary || '',
            projectName: parsed.metadata?.projectName
          }
        };

        console.log('[RD Analysis] 解析成功:', {
          userStories: rdAnalysis.documents?.userStories?.length || 0,
          requirements: rdAnalysis.documents?.requirements?.length || 0,
          apiDesign: rdAnalysis.documents?.apiDesign?.length || 0,
          databaseDesign: rdAnalysis.documents?.databaseDesign?.length || 0,
          technicalDecisions: rdAnalysis.documents?.technicalDecisions?.length || 0,
          diagrams: Object.keys(rdAnalysis.diagrams || {}).filter(k => rdAnalysis.diagrams[k] !== null).length
        });

      } catch (parseError) {
        console.error("[RD Analysis] JSON 解析錯誤:", parseError);
        console.error("[RD Analysis] 原始回應:", analysisText.substring(0, 500));

        // Fallback structure
        rdAnalysis = {
          documents: {
            userStories: [],
            requirements: [],
            apiDesign: [],
            systemArchitecture: {
              overview: "無法解析 AI 回應",
              components: [],
              interactions: []
            },
            databaseDesign: [],
            technicalDecisions: []
          },
          diagrams: {},
          metadata: {
            discussionDate: new Date().toISOString().split('T')[0],
            participants: [],
            summary: "AI 分析結果解析失敗，請重試"
          }
        };
      }

      // Save RD analysis results to database
      await storage.updateTranscription(id, {
        rdAnalysis: rdAnalysis,
        analysisMode: 'rd'
      });

      // Return updated transcription
      const updatedTranscription = await storage.getTranscription(id);

      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'rd_analysis_completed',
        description: `轉錄${id}完成 RD 模式分析`,
        details: {
          transcriptionId: id,
          userStories: rdAnalysis.documents?.userStories?.length || 0,
          requirements: rdAnalysis.documents?.requirements?.length || 0,
          apiEndpoints: rdAnalysis.documents?.apiDesign?.length || 0,
          diagrams: Object.keys(rdAnalysis.diagrams || {}).filter(k => rdAnalysis.diagrams[k] !== null).length
        }
      });

      res.json(updatedTranscription);
    } catch (error) {
      console.error("[RD Analysis] 錯誤:", error);

      await AdminLogger.log({
        category: 'ai_analysis',
        action: 'rd_analysis_error',
        description: `轉錄${id} RD 分析失敗`,
        severity: 'high',
        details: { error: error instanceof Error ? error.message : String(error) }
      });

      res.status(500).json({
        message: error instanceof Error ? error.message : "RD 分析失敗"
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

      // Check if we have content to clean - either in transcriptText or segments
      let textToClean = transcription.transcriptText;
      
      if (!textToClean && transcription.segments) {
        // Extract text from segments if transcriptText is empty
        const segments = transcription.segments as any[];
        if (Array.isArray(segments) && segments.length > 0) {
          textToClean = segments.map((segment: any) => segment.text).join(' ');
        }
      }
      
      if (!textToClean) {
        return res.status(400).json({ message: "沒有可整理的逐字稿內容" });
      }

      // For large text, use basic cleaning instead of AI processing to avoid timeout
      if (textToClean.length > 5000) {
        const cleanedResult = {
          cleanedText: textToClean
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .replace(/([。！？])\s*/g, '$1 ')  // Add space after punctuation
            .replace(/\s*([，、：；])\s*/g, '$1 ')  // Normalize comma spacing
            .trim(),
          improvements: ["基本格式整理", "標點符號規範化", "空格統一處理"]
        };
        return res.json(cleanedResult);
      }

      const analyzer = new GeminiAnalyzer();
      const cleanedResult = await analyzer.cleanTranscript(textToClean);

      res.json(cleanedResult);
    } catch (error) {
      console.error("Gemini cleaning error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "逐字稿整理失敗" 
      });
    }
  });

  // Note: Restore endpoint removed - now using Google Cloud Speech-to-Text

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

      // Extract speakers from existing segments if speakers array is empty
      let originalSpeakers = Array.isArray(transcription.speakers) ? transcription.speakers : [];
      
      if (originalSpeakers.length === 0 && transcription.segments) {
        const segments = transcription.segments as any[];
        const speakersSet = new Set<string>();
        
        segments.forEach((segment: any) => {
          if (segment.speaker) {
            speakersSet.add(segment.speaker);
          }
        });
        
        const colors = ['hsl(220, 70%, 50%)', 'hsl(120, 70%, 50%)', 'hsl(0, 70%, 50%)', 'hsl(280, 70%, 50%)', 'hsl(40, 70%, 50%)'];
        originalSpeakers = Array.from(speakersSet).map((speaker, index) => ({
          id: speaker,
          label: speaker,
          color: colors[index % colors.length]
        }));
        
        // Update the transcription with the speakers data for future use
        await storage.updateTranscription(id, {
          speakers: originalSpeakers
        });
      }
      
      if (originalSpeakers.length === 0) {
        return res.status(400).json({ message: "無法找到講者資料" });
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

  // Get usage statistics (admin sees all, user sees own data)
  app.get("/api/usage/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const usageTracker = new UsageTracker();
      const isAdmin = req.user!.role === 'admin';
      // Admin sees all data (userId = null), user sees only their own data
      const userId = isAdmin ? null : req.user!.id;
      const stats = await usageTracker.getUsageStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Get usage stats error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "獲取使用統計失敗"
      });
    }
  });

  // Get monthly usage trend (admin sees all, user sees own data)
  app.get("/api/usage/trend", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const usageTracker = new UsageTracker();
      const isAdmin = req.user!.role === 'admin';
      // Admin sees all data (userId = null), user sees only their own data
      const userId = isAdmin ? null : req.user!.id;
      const trend = await usageTracker.getMonthlyTrend(userId);
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

  // Admin transcription management routes
  app.get("/api/admin/transcriptions", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const allTranscriptions = await db
        .select({
          id: transcriptions.id,
          userId: transcriptions.userId,
          username: users.name,
          userEmail: users.email,
          filename: transcriptions.filename,
          originalName: transcriptions.originalName,
          displayName: transcriptions.displayName,
          fileSize: transcriptions.fileSize,
          status: transcriptions.status,
          progress: transcriptions.progress,
          duration: transcriptions.duration,
          wordCount: transcriptions.wordCount,
          createdAt: transcriptions.createdAt,
          updatedAt: transcriptions.updatedAt,
        })
        .from(transcriptions)
        .leftJoin(users, eq(transcriptions.userId, users.id))
        .orderBy(desc(transcriptions.createdAt));
      
      await AdminLogger.log({
        category: "admin",
        action: "transcriptions_accessed",
        description: "管理員查看所有用戶轉錄資料",
        severity: "info",
        details: {
          adminId: req.user!.id,
          transcriptionCount: allTranscriptions?.length || 0
        }
      });
      
      res.json(allTranscriptions);
    } catch (error) {
      console.error("Get admin transcriptions error:", error);
      res.status(500).json({ message: "獲取轉錄資料失敗" });
    }
  });

  app.delete("/api/admin/transcriptions/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const transcriptionId = parseInt(req.params.id);
      const adminId = req.user!.id;

      // Get transcription details before deletion
      const [transcription] = await db
        .select()
        .from(transcriptions)
        .where(eq(transcriptions.id, transcriptionId));

      if (!transcription) {
        return res.status(404).json({ message: "轉錄記錄不存在" });
      }

      await db.delete(transcriptions).where(eq(transcriptions.id, transcriptionId));

      await AdminLogger.log({
        category: "admin",
        action: "transcription_deleted",
        description: `管理員刪除轉錄記錄: ${transcription.originalName}`,
        severity: "warning",
        details: {
          adminId,
          transcriptionId,
          originalUserId: transcription.userId,
          filename: transcription.filename
        }
      });

      res.json({ message: "轉錄記錄已刪除" });
    } catch (error) {
      console.error("Delete transcription error:", error);
      res.status(500).json({ message: "刪除轉錄記錄失敗" });
    }
  });

  // Admin user management routes
  app.patch("/api/admin/users/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;
      
      // Validate updates
      const allowedFields = ['role', 'status', 'name'];
      const validUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ message: "沒有有效的更新欄位" });
      }

      // Update user
      const [updatedUser] = await db
        .update(users)
        .set({
          ...validUpdates,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ message: "找不到用戶" });
      }

      await AdminLogger.log({
        category: "admin",
        action: "user_updated",
        description: `管理員更新用戶資訊: ${updatedUser.email}`,
        severity: "info",
        details: {
          adminId: req.user!.id,
          userId,
          updates: validUpdates
        }
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "更新用戶失敗" });
    }
  });

  app.post("/api/admin/create-user", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { email, name, role = 'user', password } = req.body;

      if (!email || !name) {
        return res.status(400).json({ message: "電子郵件和姓名為必填欄位" });
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      if (existingUser) {
        return res.status(400).json({ message: "此電子郵件已被使用" });
      }

      // Generate password if not provided
      const finalPassword = password || AuthService.generateToken().substring(0, 12);
      const hashedPassword = await AuthService.hashPassword(finalPassword);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          name,
          password: hashedPassword,
          role,
          status: 'active'
        })
        .returning();

      await AdminLogger.log({
        category: "admin",
        action: "user_created",
        description: `管理員創建新用戶帳號: ${email}`,
        severity: "success",
        details: {
          adminId: req.user!.id,
          newUserId: newUser.id,
          email,
          name,
          role,
          passwordGenerated: !password
        }
      });

      res.json({
        success: true,
        temporaryPassword: password ? undefined : finalPassword,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          status: newUser.status
        }
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ message: "創建用戶失敗" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent admin from deleting themselves
      if (userId === req.user!.id) {
        return res.status(400).json({ message: "無法刪除自己的帳號" });
      }

      // Get user info before deletion for logging
      const [userToDelete] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!userToDelete) {
        return res.status(404).json({ message: "找不到用戶" });
      }

      // Delete user
      await db
        .delete(users)
        .where(eq(users.id, userId));

      await AdminLogger.log({
        category: "admin",
        action: "user_deleted",
        description: `管理員刪除用戶: ${userToDelete.email}`,
        severity: "warning",
        details: {
          adminId: req.user!.id,
          deletedUserId: userId,
          deletedUserEmail: userToDelete.email
        }
      });

      res.json({ message: "用戶已刪除" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "刪除用戶失敗" });
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

  // Transcription configuration routes
  app.get("/api/transcription-config", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const config = await storage.getTranscriptionConfig(userId);
      res.json(config);
    } catch (error) {
      console.error("Error fetching transcription config:", error);
      res.status(500).json({ message: "獲取配置失敗" });
    }
  });

  app.post("/api/transcription-config", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const config = req.body;

      await storage.saveTranscriptionConfig(userId, config);

      await AdminLogger.log({
        category: 'transcription',
        action: 'config_updated',
        description: `用戶 ${req.user!.email} 更新轉錄配置`,
        details: {
          userId,
          configName: config.config_name,
          presetType: config.boost_param
        }
      });

    } catch (error) {
      console.error("[API Error]", error);
      res.status(500).json({ message: "操作失敗" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
