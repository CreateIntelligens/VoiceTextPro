import { db } from './db';
import { userUsage, transcriptions } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * User Usage Service - 追蹤用戶使用量
 */
export class UserUsageService {
  /**
   * 獲取週期起始時間
   */
  private static getPeriodStart(periodType: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();

    switch (periodType) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 週日開始
        return weekStart;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  /**
   * 記錄使用量
   */
  static async recordUsage(
    userId: number,
    audioMinutes: number = 0,
    fileSizeBytes: number = 0
  ): Promise<void> {
    const periods: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];

    for (const periodType of periods) {
      const periodStart = this.getPeriodStart(periodType);

      // 嘗試更新現有記錄，或插入新記錄
      const [existing] = await db.select()
        .from(userUsage)
        .where(
          and(
            eq(userUsage.userId, userId),
            eq(userUsage.periodType, periodType),
            gte(userUsage.periodStart, periodStart)
          )
        );

      if (existing) {
        await db.update(userUsage)
          .set({
            audioMinutes: existing.audioMinutes + Math.ceil(audioMinutes),
            transcriptionCount: existing.transcriptionCount + 1,
            storageBytesUsed: existing.storageBytesUsed + fileSizeBytes,
            updatedAt: new Date(),
          })
          .where(eq(userUsage.id, existing.id));
      } else {
        await db.insert(userUsage).values({
          userId,
          periodType,
          periodStart,
          audioMinutes: Math.ceil(audioMinutes),
          transcriptionCount: 1,
          storageBytesUsed: fileSizeBytes,
        });
      }
    }
  }

  /**
   * 獲取用戶在指定週期的使用量
   */
  static async getUsageForPeriod(
    userId: number,
    periodType: 'daily' | 'weekly' | 'monthly'
  ): Promise<{
    audioMinutes: number;
    transcriptionCount: number;
    storageBytesUsed: number;
  }> {
    const periodStart = this.getPeriodStart(periodType);

    const [usage] = await db.select()
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          eq(userUsage.periodType, periodType),
          gte(userUsage.periodStart, periodStart)
        )
      );

    return {
      audioMinutes: usage?.audioMinutes ?? 0,
      transcriptionCount: usage?.transcriptionCount ?? 0,
      storageBytesUsed: usage?.storageBytesUsed ?? 0,
    };
  }

  /**
   * 計算用戶總儲存空間使用量
   */
  static async calculateTotalStorageUsed(userId: number): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${transcriptions.fileSize}), 0)`,
    })
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId));

    return result[0]?.total ?? 0;
  }

  /**
   * 重置過期的使用量記錄（可用於定時任務）
   */
  static async cleanupOldUsageRecords(): Promise<void> {
    const now = new Date();

    // 保留最近 90 天的記錄
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    await db.delete(userUsage)
      .where(sql`${userUsage.periodStart} < ${cutoff}`);
  }

  /**
   * 獲取用戶的完整使用歷史（用於圖表）
   */
  static async getUsageHistory(
    userId: number,
    periodType: 'daily' | 'weekly' | 'monthly',
    limit: number = 30
  ): Promise<Array<{
    periodStart: Date;
    audioMinutes: number;
    transcriptionCount: number;
  }>> {
    const records = await db.select({
      periodStart: userUsage.periodStart,
      audioMinutes: userUsage.audioMinutes,
      transcriptionCount: userUsage.transcriptionCount,
    })
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          eq(userUsage.periodType, periodType)
        )
      )
      .orderBy(sql`${userUsage.periodStart} DESC`)
      .limit(limit);

    return records.reverse();
  }

  /**
   * 從轉錄記錄重建使用量（修復用）
   */
  static async rebuildUsageFromTranscriptions(userId: number): Promise<void> {
    // 刪除現有使用量記錄
    await db.delete(userUsage)
      .where(eq(userUsage.userId, userId));

    // 從 transcriptions 重建
    const userTranscriptions = await db.select({
      fileSize: transcriptions.fileSize,
      duration: transcriptions.duration,
      createdAt: transcriptions.createdAt,
    })
      .from(transcriptions)
      .where(eq(transcriptions.userId, userId));

    // 按日期分組並記錄
    for (const t of userTranscriptions) {
      if (t.createdAt) {
        // 簡化版：直接記錄到當前週期
        await this.recordUsage(
          userId,
          (t.duration ?? 0) / 60, // 秒轉分鐘
          t.fileSize
        );
      }
    }
  }
}

export default UserUsageService;
