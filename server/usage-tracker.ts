import { db } from './db';
import { transcriptions } from '@shared/schema';
import { count, sql, sum, eq, and } from 'drizzle-orm';

interface UsageStats {
  speechToText: {
    totalTranscriptions: number;
    totalAudioMinutes: number;
    totalAudioSeconds: number;
    monthlyAudioMinutes: number;
    monthlyAudioSeconds: number;
    costEstimate: number;
    monthlyCostEstimate: number;
  };
  gemini: {
    totalRequests: number;
    totalTokens: number;
    monthlyTokens: number;
    remainingTokens?: number;
    costEstimate: number;
  };
  system: {
    totalTranscriptions: number;
    totalAudioMinutes: number;
    totalStorageUsed: number;
    activeTranscriptions: number;
    completedTranscriptions: number;
    errorTranscriptions: number;
  };
}

export class UsageTracker {
  // Google Cloud Speech-to-Text V2 pricing (Chirp 3 model)
  // 參考: https://cloud.google.com/speech-to-text/v2/pricing
  // Chirp 3 批次處理: $0.012 per minute (每分鐘 0.012 美元)
  private static readonly SPEECH_COST_PER_MINUTE = 0.012; // USD per minute (Chirp 3 batch)

  // Gemini 2.0 Flash pricing
  // 參考: https://ai.google.dev/pricing
  private static readonly GEMINI_INPUT_COST_PER_1M = 0.10; // USD per 1M input tokens
  private static readonly GEMINI_OUTPUT_COST_PER_1M = 0.40; // USD per 1M output tokens
  private static readonly GEMINI_MONTHLY_LIMIT = 1500000; // Free tier: 1.5M tokens per minute

  // userId: null = all users (admin view), number = specific user
  async getUsageStats(userId?: number | null): Promise<UsageStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Build user filter condition
    const userFilter = userId !== undefined && userId !== null
      ? sql`user_id = ${userId}`
      : sql`1=1`;

    // Get transcription statistics
    const totalTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(userFilter);

    const completedTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status = 'completed' AND ${userFilter}`);

    const errorTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status = 'error' AND ${userFilter}`);

    const activeTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status IN ('processing', 'pending') AND ${userFilter}`);

    // Calculate actual audio duration from database (duration is in seconds)
    const audioStats = await db
      .select({
        totalDuration: sql<number>`COALESCE(SUM(duration), 0)`,
        totalSize: sql<number>`COALESCE(SUM(file_size), 0)`,
        monthlyDuration: sql<number>`COALESCE(SUM(CASE WHEN created_at >= ${startOfMonth} THEN duration ELSE 0 END), 0)`,
        monthlySize: sql<number>`COALESCE(SUM(CASE WHEN created_at >= ${startOfMonth} THEN file_size ELSE 0 END), 0)`
      })
      .from(transcriptions)
      .where(sql`status = 'completed' AND ${userFilter}`);

    const totalAudioSeconds = Number(audioStats[0]?.totalDuration) || 0;
    const totalAudioMinutes = Math.ceil(totalAudioSeconds / 60); // Google charges per minute, rounded up
    const monthlyAudioSeconds = Number(audioStats[0]?.monthlyDuration) || 0;
    const monthlyAudioMinutes = Math.ceil(monthlyAudioSeconds / 60);
    const totalStorageUsed = Number(audioStats[0]?.totalSize) || 0;

    // Calculate Speech-to-Text costs
    const speechCostEstimate = totalAudioMinutes * UsageTracker.SPEECH_COST_PER_MINUTE;
    const monthlySpeechCostEstimate = monthlyAudioMinutes * UsageTracker.SPEECH_COST_PER_MINUTE;

    // Estimate Gemini usage (approximate based on completed transcriptions)
    // Each transcription may use: 1x cleanup + 1x analysis
    const completedCount = completedTranscriptions[0]?.count || 0;
    const estimatedGeminiRequests = completedCount * 2; // Clean + Analysis
    const estimatedInputTokens = estimatedGeminiRequests * 4000; // ~4K input tokens per request
    const estimatedOutputTokens = estimatedGeminiRequests * 2000; // ~2K output tokens per request
    const totalTokens = estimatedInputTokens + estimatedOutputTokens;

    // Monthly tokens estimation
    const monthlyCompletedCount = await this.getMonthlyCompletedCount(startOfMonth, userId);
    const monthlyGeminiRequests = monthlyCompletedCount * 2;
    const monthlyInputTokens = monthlyGeminiRequests * 4000;
    const monthlyOutputTokens = monthlyGeminiRequests * 2000;
    const monthlyTokens = monthlyInputTokens + monthlyOutputTokens;

    // Calculate Gemini costs
    const geminiCost = (estimatedInputTokens / 1000000) * UsageTracker.GEMINI_INPUT_COST_PER_1M +
                       (estimatedOutputTokens / 1000000) * UsageTracker.GEMINI_OUTPUT_COST_PER_1M;

    return {
      speechToText: {
        totalTranscriptions: totalTranscriptions[0]?.count || 0,
        totalAudioMinutes,
        totalAudioSeconds,
        monthlyAudioMinutes,
        monthlyAudioSeconds,
        costEstimate: speechCostEstimate,
        monthlyCostEstimate: monthlySpeechCostEstimate
      },
      gemini: {
        totalRequests: estimatedGeminiRequests,
        totalTokens,
        monthlyTokens,
        remainingTokens: Math.max(0, UsageTracker.GEMINI_MONTHLY_LIMIT - monthlyTokens),
        costEstimate: geminiCost
      },
      system: {
        totalTranscriptions: totalTranscriptions[0]?.count || 0,
        totalAudioMinutes,
        totalStorageUsed,
        activeTranscriptions: activeTranscriptions[0]?.count || 0,
        completedTranscriptions: completedCount,
        errorTranscriptions: errorTranscriptions[0]?.count || 0
      }
    };
  }

  private async getMonthlyCompletedCount(startOfMonth: Date, userId?: number | null): Promise<number> {
    const userFilter = userId !== undefined && userId !== null
      ? sql`user_id = ${userId}`
      : sql`1=1`;

    const result = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status = 'completed' AND created_at >= ${startOfMonth} AND ${userFilter}`);
    return result[0]?.count || 0;
  }

  // userId: null = all users (admin view), number = specific user
  async getMonthlyTrend(userId?: number | null): Promise<Array<{ date: string; transcriptions: number; minutes: number }>> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const userFilter = userId !== undefined && userId !== null
      ? sql`user_id = ${userId}`
      : sql`1=1`;

    const dailyStats = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        count: count(),
        totalDuration: sql<number>`COALESCE(SUM(duration), 0)`
      })
      .from(transcriptions)
      .where(sql`created_at >= ${last30Days} AND status = 'completed' AND ${userFilter}`)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return dailyStats.map(stat => ({
      date: stat.date,
      transcriptions: stat.count,
      minutes: Math.ceil((stat.totalDuration || 0) / 60)
    }));
  }
}
