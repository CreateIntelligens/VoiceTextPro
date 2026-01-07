import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from './db';
import { users, userSessions, accountApplications, notifications, systemSettings, SYSTEM_SETTING_KEYS } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';
import { EmailService } from './email-service';
import { TokenService } from './token-service';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    status: string;
    emailVerified?: boolean;
  };
}

export type RegistrationMode = 'open' | 'application';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  /**
   * 獲取當前註冊模式
   */
  static async getRegistrationMode(): Promise<RegistrationMode> {
    const [setting] = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SYSTEM_SETTING_KEYS.REGISTRATION_MODE));

    return (setting?.value as RegistrationMode) || 'application';
  }

  /**
   * 設定註冊模式
   */
  static async setRegistrationMode(mode: RegistrationMode): Promise<void> {
    await db.insert(systemSettings)
      .values({
        key: SYSTEM_SETTING_KEYS.REGISTRATION_MODE,
        value: mode,
        description: '註冊模式：open=開放註冊, application=申請制',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: mode,
          updatedAt: new Date(),
        },
      });
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  static async createSession(userId: number): Promise<string> {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await db.insert(userSessions).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  static async validateSession(token: string): Promise<any> {
    const session = await db
      .select({
        userId: userSessions.userId,
        expiresAt: userSessions.expiresAt,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(eq(userSessions.token, token))
      .limit(1);

    if (!session.length) return null;

    const user = session[0];
    if (new Date() > user.expiresAt) {
      // Token expired
      await db.delete(userSessions).where(eq(userSessions.token, token));
      return null;
    }

    return {
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  static async login(email: string, password: string): Promise<{ user: any; token: string; isFirstLogin?: boolean; error?: string } | null> {
    console.log('Login attempt for:', email);

    // 先找用戶（不限狀態）
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    console.log('User found:', user ? 'Yes' : 'No');
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.password);
    console.log('Password valid:', isValid);
    if (!isValid) return null;

    // 檢查用戶狀態
    console.log('User status:', user.status);
    if (user.status === 'pending') {
      return { user: null, token: '', error: '您的帳號正在等待管理員審核，審核通過後將會通知您' };
    }
    if (user.status === 'pending_verification') {
      return { user: null, token: '', error: '請先完成 Email 驗證，驗證郵件已發送至您的信箱' };
    }
    if (user.status === 'suspended') {
      return { user: null, token: '', error: '您的帳號已被停用，請聯繫管理員' };
    }
    if (user.status !== 'active') {
      return { user: null, token: '', error: '帳號狀態異常，請聯繫管理員' };
    }

    // Check if it's first login and update
    const isFirstLogin = user.isFirstLogin;
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        isFirstLogin: false 
      })
      .where(eq(users.id, user.id));

    const token = await this.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      token,
      isFirstLogin,
    };
  }

  static async logout(token: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.token, token));
  }

  /**
   * 原有的註冊方法（管理員直接創建用戶，不需要 Email 驗證）
   */
  static async registerUser(email: string, name: string, role: string = 'user'): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> {
    try {
      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        return { success: false, error: '此郵箱已註冊' };
      }

      // Generate random password
      const temporaryPassword = EmailService.generateRandomPassword(12);
      const hashedPassword = await this.hashPassword(temporaryPassword);

      // Create user (已驗證，因為是管理員創建)
      const [newUser] = await db.insert(users).values({
        email,
        name,
        password: hashedPassword,
        role,
        status: 'active',
        isFirstLogin: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }).returning();

      // Send welcome email with temporary password
      const emailTemplate = EmailService.generateWelcomeEmail(email, name, temporaryPassword);
      const emailSent = await EmailService.sendEmail(emailTemplate);

      if (!emailSent) {
        console.error('Failed to send welcome email to:', email);
        // Don't fail registration if email fails
      }

      return { success: true, temporaryPassword };
    } catch (error) {
      console.error('User registration error:', error);
      return { success: false, error: '註冊失敗，請稍後再試' };
    }
  }

  /**
   * 新的自助註冊方法（需要 Email 驗證）
   */
  static async registerWithEmailVerification(
    email: string,
    password: string,
    name: string,
    baseUrl: string
  ): Promise<{ success: boolean; message?: string; requiresVerification?: boolean; needsAdminApproval?: boolean; error?: string }> {
    try {
      // 檢查用戶是否已存在
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        return { success: false, error: '此郵箱已註冊' };
      }

      // 驗證密碼強度
      if (password.length < 8) {
        return { success: false, error: '密碼需至少 8 個字元' };
      }

      const hashedPassword = await this.hashPassword(password);
      const registrationMode = await this.getRegistrationMode();

      // 創建用戶（狀態為待驗證）
      const [newUser] = await db.insert(users).values({
        email,
        name,
        password: hashedPassword,
        role: 'user',
        status: 'pending_verification',
        isFirstLogin: false,
        emailVerified: false,
      }).returning();

      // 創建驗證 Token
      const token = await TokenService.createEmailVerificationToken(newUser.id);
      const verificationLink = `${baseUrl}/verify-email/${token}`;

      // 發送驗證郵件
      const emailSent = await EmailService.sendVerificationEmail(email, name, verificationLink);

      if (!emailSent) {
        console.error('Failed to send verification email to:', email);
        // 刪除剛創建的用戶
        await db.delete(users).where(eq(users.id, newUser.id));
        return { success: false, error: '驗證郵件發送失敗，請稍後再試' };
      }

      return {
        success: true,
        message: '註冊成功！請檢查您的信箱並點擊驗證連結完成註冊',
        requiresVerification: true,
        needsAdminApproval: registrationMode === 'application',
      };
    } catch (error) {
      console.error('Registration with email verification error:', error);
      return { success: false, error: '註冊失敗，請稍後再試' };
    }
  }

  /**
   * 驗證 Email
   */
  static async verifyEmail(token: string): Promise<{ success: boolean; email?: string; needsAdminApproval?: boolean; error?: string }> {
    try {
      const result = await TokenService.verifyEmailToken(token);

      if (!result) {
        return { success: false, error: '驗證連結無效或已過期' };
      }

      const registrationMode = await this.getRegistrationMode();

      if (registrationMode === 'open') {
        // 開放註冊模式：直接啟用帳號
        await db.update(users)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(users.id, result.userId));

        return { success: true, email: result.email, needsAdminApproval: false };
      } else {
        // 申請制模式：更新狀態為待審核
        await db.update(users)
          .set({ status: 'pending', updatedAt: new Date() })
          .where(eq(users.id, result.userId));

        // 通知管理員
        const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
        for (const admin of adminUsers) {
          await db.insert(notifications).values({
            userId: admin.id,
            type: 'account_application',
            title: '新用戶待審核',
            message: `用戶 ${result.email} 已完成 Email 驗證，等待審核。`,
          });
        }

        return { success: true, email: result.email, needsAdminApproval: true };
      }
    } catch (error) {
      console.error('Email verification error:', error);
      return { success: false, error: '驗證失敗，請稍後再試' };
    }
  }

  /**
   * 重新發送驗證郵件（支援 email 或 userId）
   */
  static async resendVerificationEmail(emailOrUserId: string | number, baseUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      let user;

      if (typeof emailOrUserId === 'number') {
        [user] = await db.select().from(users).where(eq(users.id, emailOrUserId));
      } else {
        [user] = await db.select().from(users).where(eq(users.email, emailOrUserId));
      }

      if (!user) {
        // 為安全起見，不透露用戶是否存在
        return { success: true };
      }

      if (user.emailVerified) {
        return { success: true }; // 不透露詳細資訊
      }

      const token = await TokenService.createEmailVerificationToken(user.id);
      const verificationLink = `${baseUrl}/verify-email/${token}`;

      const emailSent = await EmailService.sendVerificationEmail(user.email, user.name || '', verificationLink);

      if (!emailSent) {
        return { success: false, error: '郵件發送失敗，請稍後再試' };
      }

      return { success: true };
    } catch (error) {
      console.error('Resend verification email error:', error);
      return { success: false, error: '發送失敗，請稍後再試' };
    }
  }

  /**
   * 發送密碼重設連結（新的 Token 驗證方式）
   */
  static async sendPasswordResetLink(email: string, baseUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // 為安全起見，無論用戶是否存在都返回成功（防止用戶枚舉）
      if (!user) {
        return { success: true };
      }

      // 檢查是否最近已請求過
      const hasRecent = await TokenService.hasRecentPasswordResetRequest(user.id, 5);
      if (hasRecent) {
        return { success: false, error: '請等待 5 分鐘後再試' };
      }

      // 創建重設 Token
      const token = await TokenService.createPasswordResetToken(user.id);
      const resetLink = `${baseUrl}/reset-password/${token}`;

      // 發送重設連結郵件
      const emailSent = await EmailService.sendPasswordResetLinkEmail(email, user.name || '', resetLink);

      if (!emailSent) {
        console.error('Failed to send password reset link to:', email);
        return { success: false, error: '郵件發送失敗，請稍後再試' };
      }

      return { success: true };
    } catch (error) {
      console.error('Send password reset link error:', error);
      return { success: false, error: '發送失敗，請稍後再試' };
    }
  }

  /**
   * 驗證密碼重設 Token（僅驗證，不執行重設）
   */
  static async verifyResetToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
    try {
      const result = await TokenService.verifyPasswordResetToken(token);
      if (!result) {
        return { valid: false, error: '重設連結無效或已過期' };
      }

      return { valid: true, email: result.email };
    } catch (error) {
      console.error('Verify reset token error:', error);
      return { valid: false, error: '驗證失敗' };
    }
  }

  /**
   * 使用 Token 重設密碼
   */
  static async resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 驗證密碼強度
      if (newPassword.length < 8) {
        return { success: false, error: '密碼需至少 8 個字元' };
      }

      // 驗證 Token
      const result = await TokenService.verifyPasswordResetToken(token);
      if (!result) {
        return { success: false, error: '重設連結無效或已過期' };
      }

      // 更新密碼
      const hashedPassword = await this.hashPassword(newPassword);
      await db.update(users)
        .set({
          password: hashedPassword,
          isFirstLogin: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, result.userId));

      // 標記 Token 為已使用
      await TokenService.markPasswordResetTokenAsUsed(token);

      // 發送密碼已變更通知
      await EmailService.sendPasswordChangedNotification(result.email);

      return { success: true };
    } catch (error) {
      console.error('Reset password with token error:', error);
      return { success: false, error: '密碼重設失敗，請稍後再試' };
    }
  }

  /**
   * 舊版密碼重設（直接發送新密碼，保留向後兼容）
   * @deprecated 使用 sendPasswordResetLink 代替
   */
  static async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return { success: false, error: '找不到此郵箱對應的用戶' };
      }

      // Generate new random password
      const newPassword = EmailService.generateRandomPassword(12);
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user password and set first login flag
      await db.update(users)
        .set({
          password: hashedPassword,
          isFirstLogin: true,
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));

      // Send password reset email
      const emailTemplate = EmailService.generatePasswordResetEmail(email, user.name || '', newPassword);
      const emailSent = await EmailService.sendEmail(emailTemplate);

      if (!emailSent) {
        console.error('Failed to send password reset email to:', email);
        return { success: false, error: '郵件發送失敗，請稍後再試' };
      }

      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: '密碼重置失敗，請稍後再試' };
    }
  }

  static async changePassword(userId: number, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const hashedPassword = await this.hashPassword(newPassword);
      
      await db.update(users)
        .set({ 
          password: hashedPassword,
          isFirstLogin: false,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: '密碼更改失敗，請稍後再試' };
    }
  }

  static async applyForAccount(email: string, name: string, reason: string): Promise<void> {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('此 Email 已經註冊過帳號');
    }

    // Check if application already exists
    const existingApplication = await db
      .select()
      .from(accountApplications)
      .where(and(eq(accountApplications.email, email), eq(accountApplications.status, 'pending')))
      .limit(1);

    if (existingApplication.length > 0) {
      throw new Error('您已經提交過申請，請等待審核');
    }

    // Create application
    await db.insert(accountApplications).values({
      email,
      name,
      reason,
    });

    // Notify admin
    const adminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'));

    for (const admin of adminUsers) {
      await db.insert(notifications).values({
        userId: admin.id,
        type: 'account_application',
        title: '新的帳號申請',
        message: `${name} (${email}) 申請建立帳號。申請理由：${reason}`,
      });
    }

    // Send email notification to admin
    await this.sendApplicationNotification(email, name, reason);
  }

  private static async sendApplicationNotification(email: string, name: string, reason: string): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      
      // 使用統一的 Gmail 服務發送管理員通知
      await EmailService.sendEmail({
        to: adminEmail,
        subject: '新的帳號申請 - VoiceTextPro',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">新的帳號申請</h2>
            <p>有新用戶申請帳號，詳情如下：</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>申請者 Email：</strong> ${email}</p>
              <p><strong>申請者姓名：</strong> ${name || '未提供'}</p>
              <p><strong>申請理由：</strong></p>
              <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
                ${reason || '未提供'}
              </div>
            </div>
            
            <p>請登入管理員面板處理此申請。</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
              <p>此郵件由 VoiceTextPro 自動發送</p>
            </div>
          </div>
        `
      });
      
      console.log('Application notification email sent successfully');
    } catch (error) {
      console.error('Failed to send application notification email:', error);
      // Don't throw error - application should still be created even if email fails
    }
  }

  static async createUser(email: string, password: string, name: string, role: string = 'user'): Promise<any> {
    const hashedPassword = await this.hashPassword(password);
    
    const [user] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        name,
        role,
        status: 'active',
      })
      .returning();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    };
  }

  static async initializeAdmin(): Promise<void> {
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      const existingAdmin = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .limit(1);

      if (existingAdmin.length === 0) {
        await this.createUser(adminEmail, adminPassword, '系統管理員', 'admin');
        console.log(`Admin user created: ${adminEmail}`);
      }
    } catch (error: any) {
      // 如果表不存在（首次啟動前未執行 db:push），跳過初始化
      if (error.code === '42P01') {
        console.log('Database tables not initialized yet. Please run "npm run db:push" first.');
      } else {
        console.error('Failed to initialize admin:', error);
      }
    }
  }
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Try token-based authentication first
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;
    
    if (token) {
      const user = await AuthService.validateSession(token);
      if (user && user.status === 'active') {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({ message: '需要登入' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: '認證失敗' });
  }
};

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: '需要管理員權限' });
    }
    next();
  });
};