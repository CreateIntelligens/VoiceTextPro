import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from './db';
import { users, userSessions, accountApplications, notifications } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    status: string;
  };
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
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

  static async login(email: string, password: string): Promise<{ user: any; token: string } | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.status, 'active')))
      .limit(1);

    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) return null;

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
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
    };
  }

  static async logout(token: string): Promise<void> {
    await db.delete(userSessions).where(eq(userSessions.token, token));
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
      if (!process.env.SENDGRID_API_KEY) {
        console.log('SendGrid API key not configured, skipping email notification');
        return;
      }

      const { MailService } = await import('@sendgrid/mail');
      const mailService = new MailService();
      mailService.setApiKey(process.env.SENDGRID_API_KEY);

      const adminEmail = 'dy052340@gmail.com';
      const msg = {
        to: adminEmail,
        from: 'noreply@transcription-platform.com',
        subject: '新的帳號申請 - 智能語音轉錄平台',
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
              <p>此郵件由智能語音轉錄平台自動發送</p>
            </div>
          </div>
        `
      };

      await mailService.send(msg);
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
    const adminEmail = 'dy052340@gmail.com';
    
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);

    if (existingAdmin.length === 0) {
      await this.createUser(adminEmail, 'admin123', '系統管理員', 'admin');
      console.log(`Admin user created: ${adminEmail}`);
    }
  }
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ message: '需要登入' });
  }

  const user = await AuthService.validateSession(token);
  if (!user) {
    return res.status(401).json({ message: '登入已過期' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: '帳號尚未啟用' });
  }

  req.user = user;
  next();
};

export const requireAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: '需要管理員權限' });
    }
    next();
  });
};