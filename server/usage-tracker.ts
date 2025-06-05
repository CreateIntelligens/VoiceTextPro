import { db } from './db';
import { transcriptions } from '@shared/schema';
import { count, sql } from 'drizzle-orm';

interface UsageStats {
  assemblyai: {
    totalTranscriptions: number;
    totalAudioMinutes: number;
    monthlyUsage: number;
    remainingMinutes?: number;
    costEstimate: number;
  };
  gemini: {
    totalRequests: number;
    totalTokens: number;
    monthlyTokens: number;
    remainingTokens?: number;
    costEstimate: number;
  };
  system: {
    totalStorageUsed: number;
    activeTranscriptions: number;
    completedTranscriptions: number;
    errorTranscriptions: number;
  };
}

export class UsageTracker {
  private static readonly ASSEMBLYAI_COST_PER_HOUR = 0.37; // USD per hour
  private static readonly GEMINI_COST_PER_1M_TOKENS = 1.5; // USD per 1M tokens
  private static readonly ASSEMBLYAI_MONTHLY_LIMIT = 500; // hours per month
  private static readonly GEMINI_MONTHLY_LIMIT = 1000000; // tokens per month

  async getUsageStats(): Promise<UsageStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get transcription statistics
    const totalTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions);

    const completedTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status = 'completed'`);

    const errorTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status = 'error'`);

    const activeTranscriptions = await db
      .select({ count: count() })
      .from(transcriptions)
      .where(sql`status IN ('processing', 'queued')`);

    // Calculate audio minutes and storage
    const audioStats = await db
      .select({
        totalSize: sql<number>`COALESCE(SUM(file_size), 0)`,
        monthlySize: sql<number>`COALESCE(SUM(CASE WHEN created_at >= ${startOfMonth} THEN file_size ELSE 0 END), 0)`
      })
      .from(transcriptions)
      .where(sql`status = 'completed'`);

    const totalAudioMinutes = this.estimateAudioMinutes(audioStats[0]?.totalSize || 0);
    const monthlyAudioMinutes = this.estimateAudioMinutes(audioStats[0]?.monthlySize || 0);

    // Estimate Gemini usage (approximate)
    const estimatedGeminiRequests = (completedTranscriptions[0]?.count || 0) * 2; // Clean + Analysis
    const estimatedTokens = estimatedGeminiRequests * 5000; // Approximate tokens per request
    const monthlyTokens = Math.floor(estimatedTokens * (monthlyAudioMinutes / totalAudioMinutes));

    return {
      assemblyai: {
        totalTranscriptions: totalTranscriptions[0]?.count || 0,
        totalAudioMinutes,
        monthlyUsage: monthlyAudioMinutes,
        remainingMinutes: Math.max(0, UsageTracker.ASSEMBLYAI_MONTHLY_LIMIT * 60 - monthlyAudioMinutes),
        costEstimate: (totalAudioMinutes / 60) * UsageTracker.ASSEMBLYAI_COST_PER_HOUR
      },
      gemini: {
        totalRequests: estimatedGeminiRequests,
        totalTokens: estimatedTokens,
        monthlyTokens,
        remainingTokens: Math.max(0, UsageTracker.GEMINI_MONTHLY_LIMIT - monthlyTokens),
        costEstimate: (estimatedTokens / 1000000) * UsageTracker.GEMINI_COST_PER_1M_TOKENS
      },
      system: {
        totalStorageUsed: audioStats[0]?.totalSize || 0,
        activeTranscriptions: activeTranscriptions[0]?.count || 0,
        completedTranscriptions: completedTranscriptions[0]?.count || 0,
        errorTranscriptions: errorTranscriptions[0]?.count || 0
      }
    };
  }

  private estimateAudioMinutes(fileSize: number): number {
    // Rough estimation: 1MB ≈ 1 minute of audio (varies by quality)
    return Math.round(fileSize / (1024 * 1024));
  }

  async getMonthlyTrend(): Promise<Array<{ date: string; transcriptions: number; minutes: number }>> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyStats = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        count: count(),
        totalSize: sql<number>`COALESCE(SUM(file_size), 0)`
      })
      .from(transcriptions)
      .where(sql`created_at >= ${last30Days} AND status = 'completed'`)
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return dailyStats.map(stat => ({
      date: stat.date,
      transcriptions: stat.count,
      minutes: this.estimateAudioMinutes(stat.totalSize)
    }));
  }
}