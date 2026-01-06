import { db } from './db';
import { userLimits, userUsage, systemSettings, users, SYSTEM_SETTING_KEYS, type DefaultLimits } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// 預設限制值
const DEFAULT_LIMITS: DefaultLimits = {
  weeklyAudioMinutes: 300,       // 每週 5 小時
  monthlyAudioMinutes: 1000,     // 每月 ~16.7 小時
  dailyTranscriptionCount: 10,   // 每天 10 次
  weeklyTranscriptionCount: 50,  // 每週 50 次
  maxFileSizeMb: 500,            // 單檔 500MB
  totalStorageMb: 5000           // 總儲存 5GB
};

export interface UserLimitResult {
  weeklyAudioMinutes: number;
  monthlyAudioMinutes: number;
  dailyTranscriptionCount: number;
  weeklyTranscriptionCount: number;
  maxFileSizeMb: number;
  totalStorageMb: number;
  isCustom: boolean;
}

export interface LimitCheckResult {
  allowed: boolean;
  limitType?: string;
  current?: number;
  limit?: number;
  message?: string;
}

export interface UsageStats {
  daily: {
    transcriptionCount: number;
    limit: number;
    percentage: number;
  };
  weekly: {
    audioMinutes: number;
    transcriptionCount: number;
    limits: {
      audioMinutes: number;
      transcriptionCount: number;
    };
    percentage: {
      audioMinutes: number;
      transcriptionCount: number;
    };
  };
  monthly: {
    audioMinutes: number;
    limit: number;
    percentage: number;
  };
  storage: {
    usedMb: number;
    limitMb: number;
    percentage: number;
  };
}

/**
 * Limit Service - 處理用戶使用限制
 */
export class LimitService {
  /**
   * 獲取系統預設限制
   */
  static async getDefaultLimits(): Promise<DefaultLimits> {
    const [setting] = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SYSTEM_SETTING_KEYS.DEFAULT_LIMITS));

    if (setting?.value) {
      return setting.value as DefaultLimits;
    }

    return DEFAULT_LIMITS;
  }

  /**
   * 設定系統預設限制
   */
  static async setDefaultLimits(limits: Partial<DefaultLimits>): Promise<DefaultLimits> {
    const currentDefaults = await this.getDefaultLimits();
    const newDefaults = { ...currentDefaults, ...limits };

    await db.insert(systemSettings)
      .values({
        key: SYSTEM_SETTING_KEYS.DEFAULT_LIMITS,
        value: newDefaults,
        description: '系統預設使用限制',
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: newDefaults,
          updatedAt: new Date(),
        },
      });

    return newDefaults;
  }

  /**
   * 獲取用戶的有效限制（自訂或預設）
   */
  static async getUserLimits(userId: number): Promise<UserLimitResult> {
    const defaults = await this.getDefaultLimits();

    const [customLimits] = await db.select()
      .from(userLimits)
      .where(eq(userLimits.userId, userId));

    if (!customLimits) {
      return { ...defaults, isCustom: false };
    }

    return {
      weeklyAudioMinutes: customLimits.weeklyAudioMinutes ?? defaults.weeklyAudioMinutes,
      monthlyAudioMinutes: customLimits.monthlyAudioMinutes ?? defaults.monthlyAudioMinutes,
      dailyTranscriptionCount: customLimits.dailyTranscriptionCount ?? defaults.dailyTranscriptionCount,
      weeklyTranscriptionCount: customLimits.weeklyTranscriptionCount ?? defaults.weeklyTranscriptionCount,
      maxFileSizeMb: customLimits.maxFileSizeMb ?? defaults.maxFileSizeMb,
      totalStorageMb: customLimits.totalStorageMb ?? defaults.totalStorageMb,
      isCustom: true,
    };
  }

  /**
   * 設定用戶自訂限制
   */
  static async setUserLimits(userId: number, limits: Partial<DefaultLimits>, notes?: string): Promise<void> {
    await db.insert(userLimits)
      .values({
        userId,
        weeklyAudioMinutes: limits.weeklyAudioMinutes,
        monthlyAudioMinutes: limits.monthlyAudioMinutes,
        dailyTranscriptionCount: limits.dailyTranscriptionCount,
        weeklyTranscriptionCount: limits.weeklyTranscriptionCount,
        maxFileSizeMb: limits.maxFileSizeMb,
        totalStorageMb: limits.totalStorageMb,
        notes,
      })
      .onConflictDoUpdate({
        target: userLimits.userId,
        set: {
          weeklyAudioMinutes: limits.weeklyAudioMinutes,
          monthlyAudioMinutes: limits.monthlyAudioMinutes,
          dailyTranscriptionCount: limits.dailyTranscriptionCount,
          weeklyTranscriptionCount: limits.weeklyTranscriptionCount,
          maxFileSizeMb: limits.maxFileSizeMb,
          totalStorageMb: limits.totalStorageMb,
          notes,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * 刪除用戶自訂限制（恢復為預設）
   */
  static async removeUserLimits(userId: number): Promise<void> {
    await db.delete(userLimits)
      .where(eq(userLimits.userId, userId));
  }

  /**
   * 檢查用戶是否可以進行上傳/轉錄
   */
  static async checkUserLimits(
    userId: number,
    fileSizeMb?: number,
    audioDurationMinutes?: number
  ): Promise<LimitCheckResult> {
    // 檢查用戶是否為管理員（管理員無限制）
    const [user] = await db.select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId));

    if (user?.role === 'admin') {
      return { allowed: true };
    }

    const limits = await this.getUserLimits(userId);
    const usage = await this.getUserUsage(userId);

    // 1. 檢查單檔大小
    if (fileSizeMb && fileSizeMb > limits.maxFileSizeMb) {
      return {
        allowed: false,
        limitType: 'maxFileSizeMb',
        current: fileSizeMb,
        limit: limits.maxFileSizeMb,
        message: `檔案大小 ${fileSizeMb}MB 超過限制 ${limits.maxFileSizeMb}MB`,
      };
    }

    // 2. 檢查每日轉錄次數
    if (usage.daily.transcriptionCount >= limits.dailyTranscriptionCount) {
      return {
        allowed: false,
        limitType: 'dailyTranscriptionCount',
        current: usage.daily.transcriptionCount,
        limit: limits.dailyTranscriptionCount,
        message: `今日已達轉錄次數上限 ${limits.dailyTranscriptionCount} 次`,
      };
    }

    // 3. 檢查每週轉錄次數
    if (usage.weekly.transcriptionCount >= limits.weeklyTranscriptionCount) {
      return {
        allowed: false,
        limitType: 'weeklyTranscriptionCount',
        current: usage.weekly.transcriptionCount,
        limit: limits.weeklyTranscriptionCount,
        message: `本週已達轉錄次數上限 ${limits.weeklyTranscriptionCount} 次`,
      };
    }

    // 4. 檢查每週音頻時長
    if (audioDurationMinutes) {
      const newWeeklyMinutes = usage.weekly.audioMinutes + audioDurationMinutes;
      if (newWeeklyMinutes > limits.weeklyAudioMinutes) {
        return {
          allowed: false,
          limitType: 'weeklyAudioMinutes',
          current: usage.weekly.audioMinutes,
          limit: limits.weeklyAudioMinutes,
          message: `本週音頻時長已達上限 ${limits.weeklyAudioMinutes} 分鐘`,
        };
      }
    }

    // 5. 檢查每月音頻時長
    if (audioDurationMinutes) {
      const newMonthlyMinutes = usage.monthly.audioMinutes + audioDurationMinutes;
      if (newMonthlyMinutes > limits.monthlyAudioMinutes) {
        return {
          allowed: false,
          limitType: 'monthlyAudioMinutes',
          current: usage.monthly.audioMinutes,
          limit: limits.monthlyAudioMinutes,
          message: `本月音頻時長已達上限 ${limits.monthlyAudioMinutes} 分鐘`,
        };
      }
    }

    // 6. 檢查總儲存空間
    if (fileSizeMb) {
      const newStorageMb = usage.storage.usedMb + fileSizeMb;
      if (newStorageMb > limits.totalStorageMb) {
        return {
          allowed: false,
          limitType: 'totalStorageMb',
          current: usage.storage.usedMb,
          limit: limits.totalStorageMb,
          message: `儲存空間已達上限 ${limits.totalStorageMb}MB`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * 獲取用戶的使用量統計
   */
  static async getUserUsage(userId: number): Promise<UsageStats> {
    const limits = await this.getUserLimits(userId);
    const now = new Date();

    // 計算各週期的起始時間
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // 週日開始
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 獲取各週期的使用量
    const [dailyUsage] = await db.select()
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          eq(userUsage.periodType, 'daily'),
          gte(userUsage.periodStart, dayStart)
        )
      );

    const [weeklyUsage] = await db.select()
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          eq(userUsage.periodType, 'weekly'),
          gte(userUsage.periodStart, weekStart)
        )
      );

    const [monthlyUsage] = await db.select()
      .from(userUsage)
      .where(
        and(
          eq(userUsage.userId, userId),
          eq(userUsage.periodType, 'monthly'),
          gte(userUsage.periodStart, monthStart)
        )
      );

    // 計算總儲存空間（從 transcriptions 計算）
    const storageUsedMb = 0; // TODO: 從 transcriptions 表計算

    return {
      daily: {
        transcriptionCount: dailyUsage?.transcriptionCount ?? 0,
        limit: limits.dailyTranscriptionCount,
        percentage: Math.min(100, ((dailyUsage?.transcriptionCount ?? 0) / limits.dailyTranscriptionCount) * 100),
      },
      weekly: {
        audioMinutes: weeklyUsage?.audioMinutes ?? 0,
        transcriptionCount: weeklyUsage?.transcriptionCount ?? 0,
        limits: {
          audioMinutes: limits.weeklyAudioMinutes,
          transcriptionCount: limits.weeklyTranscriptionCount,
        },
        percentage: {
          audioMinutes: Math.min(100, ((weeklyUsage?.audioMinutes ?? 0) / limits.weeklyAudioMinutes) * 100),
          transcriptionCount: Math.min(100, ((weeklyUsage?.transcriptionCount ?? 0) / limits.weeklyTranscriptionCount) * 100),
        },
      },
      monthly: {
        audioMinutes: monthlyUsage?.audioMinutes ?? 0,
        limit: limits.monthlyAudioMinutes,
        percentage: Math.min(100, ((monthlyUsage?.audioMinutes ?? 0) / limits.monthlyAudioMinutes) * 100),
      },
      storage: {
        usedMb: storageUsedMb,
        limitMb: limits.totalStorageMb,
        percentage: Math.min(100, (storageUsedMb / limits.totalStorageMb) * 100),
      },
    };
  }

  /**
   * 獲取超過限制的用戶列表
   */
  static async getOverLimitUsers(): Promise<Array<{
    userId: number;
    email: string;
    name: string | null;
    violations: Array<{
      limitType: string;
      limit: number;
      current: number;
      percentage: number;
    }>;
  }>> {
    // 獲取所有非管理員用戶
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
      .from(users)
      .where(eq(users.role, 'user'));

    const overLimitUsers = [];

    for (const user of allUsers) {
      const usage = await this.getUserUsage(user.id);
      const violations = [];

      // 檢查各項限制
      if (usage.daily.percentage >= 100) {
        violations.push({
          limitType: 'dailyTranscriptionCount',
          limit: usage.daily.limit,
          current: usage.daily.transcriptionCount,
          percentage: usage.daily.percentage,
        });
      }

      if (usage.weekly.percentage.audioMinutes >= 100) {
        violations.push({
          limitType: 'weeklyAudioMinutes',
          limit: usage.weekly.limits.audioMinutes,
          current: usage.weekly.audioMinutes,
          percentage: usage.weekly.percentage.audioMinutes,
        });
      }

      if (usage.weekly.percentage.transcriptionCount >= 100) {
        violations.push({
          limitType: 'weeklyTranscriptionCount',
          limit: usage.weekly.limits.transcriptionCount,
          current: usage.weekly.transcriptionCount,
          percentage: usage.weekly.percentage.transcriptionCount,
        });
      }

      if (usage.monthly.percentage >= 100) {
        violations.push({
          limitType: 'monthlyAudioMinutes',
          limit: usage.monthly.limit,
          current: usage.monthly.audioMinutes,
          percentage: usage.monthly.percentage,
        });
      }

      if (usage.storage.percentage >= 100) {
        violations.push({
          limitType: 'totalStorageMb',
          limit: usage.storage.limitMb,
          current: usage.storage.usedMb,
          percentage: usage.storage.percentage,
        });
      }

      if (violations.length > 0) {
        overLimitUsers.push({
          userId: user.id,
          email: user.email,
          name: user.name,
          violations,
        });
      }
    }

    return overLimitUsers;
  }
}

export default LimitService;
