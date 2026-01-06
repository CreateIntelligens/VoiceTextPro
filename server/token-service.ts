import crypto from 'crypto';
import { db } from './db';
import { emailVerificationTokens, passwordResetTokens, users } from '@shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';

const VERIFICATION_TOKEN_HOURS = 24;
const PASSWORD_RESET_TOKEN_MINUTES = 60;

/**
 * Token Service - 處理 Email 驗證和密碼重設的 Token
 */
export class TokenService {
  /**
   * 生成安全的隨機 Token
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 創建 Email 驗證 Token
   * @param userId 用戶 ID
   * @returns Token 字串
   */
  static async createEmailVerificationToken(userId: number): Promise<string> {
    // 刪除該用戶的舊 Token
    await db.delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  /**
   * 驗證 Email 驗證 Token
   * @param token Token 字串
   * @returns 用戶資訊或 null
   */
  static async verifyEmailToken(token: string): Promise<{ userId: number; email: string } | null> {
    const [record] = await db.select({
      userId: emailVerificationTokens.userId,
      expiresAt: emailVerificationTokens.expiresAt,
      createdAt: emailVerificationTokens.createdAt,
      email: users.email,
    })
      .from(emailVerificationTokens)
      .innerJoin(users, eq(emailVerificationTokens.userId, users.id))
      .where(eq(emailVerificationTokens.token, token));

    if (!record) {
      return null;
    }

    // 使用 createdAt + 24 小時來判斷是否過期（避免時區問題）
    const createdTime = new Date(record.createdAt!).getTime();
    const expiryTime = createdTime + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    if (now > expiryTime) {
      console.log(`Email Token 已過期: 建立於 ${record.createdAt}, 現在 ${new Date()}`);
      return null;
    }

    // 更新用戶狀態
    await db.update(users)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, record.userId));

    // 刪除使用過的 Token
    await db.delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token));

    return { userId: record.userId, email: record.email };
  }

  /**
   * 創建密碼重設 Token
   * @param userId 用戶 ID
   * @returns Token 字串
   */
  static async createPasswordResetToken(userId: number): Promise<string> {
    // 刪除該用戶的舊 Token（未使用的）
    await db.delete(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt)
        )
      );

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  /**
   * 驗證密碼重設 Token
   * @param token Token 字串
   * @returns 用戶資訊或 null
   */
  static async verifyPasswordResetToken(token: string): Promise<{ userId: number; email: string } | null> {
    const [record] = await db.select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      createdAt: passwordResetTokens.createdAt,
      usedAt: passwordResetTokens.usedAt,
      email: users.email,
    })
      .from(passwordResetTokens)
      .innerJoin(users, eq(passwordResetTokens.userId, users.id))
      .where(
        and(
          eq(passwordResetTokens.token, token),
          isNull(passwordResetTokens.usedAt)
        )
      );

    if (!record) {
      return null;
    }

    // 使用 createdAt + 60 分鐘來判斷是否過期（避免時區問題）
    const createdTime = new Date(record.createdAt!).getTime();
    const expiryTime = createdTime + PASSWORD_RESET_TOKEN_MINUTES * 60 * 1000;
    const now = Date.now();

    if (now > expiryTime) {
      console.log(`Token 已過期: 建立於 ${record.createdAt}, 現在 ${new Date()}`);
      return null;
    }

    return { userId: record.userId, email: record.email };
  }

  /**
   * 標記密碼重設 Token 為已使用
   * @param token Token 字串
   */
  static async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  /**
   * 清理過期的 Token（可定時執行）
   */
  static async cleanupExpiredTokens(): Promise<{ emailTokens: number; passwordTokens: number }> {
    const now = new Date();

    // 清理過期的 Email 驗證 Token
    const emailResult = await db.delete(emailVerificationTokens)
      .where(gt(now, emailVerificationTokens.expiresAt));

    // 清理過期或已使用的密碼重設 Token
    const passwordResult = await db.delete(passwordResetTokens)
      .where(gt(now, passwordResetTokens.expiresAt));

    return {
      emailTokens: 0, // Drizzle 不直接返回刪除數量
      passwordTokens: 0,
    };
  }

  /**
   * 檢查用戶是否有待處理的 Email 驗證 Token
   * @param userId 用戶 ID
   */
  static async hasPendingEmailVerification(userId: number): Promise<boolean> {
    const [record] = await db.select({ id: emailVerificationTokens.id })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          gt(emailVerificationTokens.expiresAt, new Date())
        )
      );

    return !!record;
  }

  /**
   * 檢查用戶最近是否已請求過密碼重設（防止濫用）
   * @param userId 用戶 ID
   * @param withinMinutes 在幾分鐘內
   */
  static async hasRecentPasswordResetRequest(userId: number, withinMinutes: number = 5): Promise<boolean> {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);

    const [record] = await db.select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          gt(passwordResetTokens.createdAt, cutoff)
        )
      );

    return !!record;
  }
}

export default TokenService;
