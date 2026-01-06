import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// 生成 VAPID 金鑰 (首次執行時需要)
// 可以使用: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@voicetextpro.com';

// 初始化 web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[Push] Web Push 已配置');
} else {
  console.warn('[Push] VAPID 金鑰未設定，推送通知功能將無法使用');
  console.warn('[Push] 請執行: npx web-push generate-vapid-keys 生成金鑰');
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    transcriptionId?: number;
    [key: string]: unknown;
  };
}

interface SubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface SubscriptionData {
  endpoint: string;
  keys: SubscriptionKeys;
}

/**
 * 推送通知服務
 */
export class PushNotificationService {
  /**
   * 獲取 VAPID 公鑰
   */
  static getVapidPublicKey(): string | null {
    return VAPID_PUBLIC_KEY || null;
  }

  /**
   * 檢查推送服務是否可用
   */
  static isAvailable(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
  }

  /**
   * 儲存用戶訂閱
   */
  static async saveSubscription(
    userId: number | null,
    subscription: SubscriptionData
  ): Promise<{ id: number }> {
    const { endpoint, keys } = subscription;

    // 檢查是否已存在相同的訂閱
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing.length > 0) {
      // 更新現有訂閱
      await db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, endpoint));

      return { id: existing[0].id };
    }

    // 建立新訂閱
    const [result] = await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      .returning({ id: pushSubscriptions.id });

    console.log(`[Push] 新訂閱已儲存: ${result.id}`);
    return result;
  }

  /**
   * 移除用戶訂閱
   */
  static async removeSubscription(endpoint: string): Promise<boolean> {
    const result = await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));

    console.log(`[Push] 訂閱已移除: ${endpoint}`);
    return true;
  }

  /**
   * 發送推送通知給特定用戶
   */
  static async sendToUser(userId: number, payload: PushPayload): Promise<number> {
    if (!this.isAvailable()) {
      console.warn('[Push] 推送服務未配置');
      return 0;
    }

    // 獲取用戶的所有訂閱
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      console.log(`[Push] 用戶 ${userId} 沒有有效的訂閱`);
      return 0;
    }

    let successCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
        successCount++;
      } catch (error: any) {
        console.error(`[Push] 發送失敗:`, error.message);

        // 如果訂閱已過期或無效，移除它
        if (error.statusCode === 404 || error.statusCode === 410) {
          await this.removeSubscription(sub.endpoint);
        }
      }
    }

    console.log(`[Push] 發送給用戶 ${userId}: ${successCount}/${subscriptions.length} 成功`);
    return successCount;
  }

  /**
   * 發送推送通知給所有訂閱者
   */
  static async sendToAll(payload: PushPayload): Promise<number> {
    if (!this.isAvailable()) {
      console.warn('[Push] 推送服務未配置');
      return 0;
    }

    const subscriptions = await db.select().from(pushSubscriptions);

    let successCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload)
        );
        successCount++;
      } catch (error: any) {
        console.error(`[Push] 發送失敗:`, error.message);

        if (error.statusCode === 404 || error.statusCode === 410) {
          await this.removeSubscription(sub.endpoint);
        }
      }
    }

    console.log(`[Push] 廣播完成: ${successCount}/${subscriptions.length} 成功`);
    return successCount;
  }

  /**
   * 發送轉錄完成通知
   */
  static async notifyTranscriptionComplete(
    userId: number | null,
    transcriptionId: number,
    filename: string
  ): Promise<void> {
    const payload: PushPayload = {
      title: '語音轉錄完成',
      body: `「${filename}」已完成轉錄，點擊查看結果。`,
      icon: '/favicon.ico',
      tag: `transcription-${transcriptionId}`,
      data: {
        url: `/transcriptions/${transcriptionId}`,
        transcriptionId,
      },
    };

    if (userId) {
      await this.sendToUser(userId, payload);
    } else {
      // 如果沒有用戶 ID，發送給所有訂閱者 (開發模式)
      await this.sendToAll(payload);
    }
  }

  /**
   * 發送轉錄失敗通知
   */
  static async notifyTranscriptionFailed(
    userId: number | null,
    transcriptionId: number,
    filename: string,
    errorMessage: string
  ): Promise<void> {
    const payload: PushPayload = {
      title: '轉錄失敗',
      body: `「${filename}」轉錄失敗: ${errorMessage.substring(0, 100)}`,
      icon: '/favicon.ico',
      tag: `transcription-error-${transcriptionId}`,
      data: {
        url: `/transcriptions/${transcriptionId}`,
        transcriptionId,
      },
    };

    if (userId) {
      await this.sendToUser(userId, payload);
    } else {
      await this.sendToAll(payload);
    }
  }
}

export default PushNotificationService;
