import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

// VAPID 公鑰 (需要在後端生成並共用)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  error: string | null;
}

interface UsePushNotificationReturn extends PushNotificationState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

/**
 * 將 Base64 URL 安全字串轉換為 Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * 推送通知 Hook
 */
export function usePushNotification(): UsePushNotificationReturn {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    permission: 'default',
    error: null,
  });

  // 檢查瀏覽器支援
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!isSupported) {
        setState(prev => ({
          ...prev,
          isSupported: false,
          isLoading: false,
          error: '您的瀏覽器不支援推送通知',
        }));
        return;
      }

      // 獲取當前權限狀態
      const permission = Notification.permission;

      // 檢查是否已訂閱
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState(prev => ({
          ...prev,
          isSupported: true,
          isSubscribed: !!subscription,
          permission,
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isSupported: true,
          permission,
          isLoading: false,
          error: null,
        }));
      }
    };

    checkSupport();
  }, []);

  // 請求通知權限
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.isSupported) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission;
    } catch (error) {
      console.error('[Push] 請求權限失敗:', error);
      return 'denied';
    }
  }, [state.isSupported]);

  // 訂閱推送通知
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: '瀏覽器不支援推送通知' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 確保有通知權限
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          permission,
          error: '未獲得通知權限',
        }));
        return false;
      }

      // 獲取 Service Worker 註冊
      const registration = await navigator.serviceWorker.ready;

      // 檢查是否已有訂閱
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // 建立新訂閱
        if (!VAPID_PUBLIC_KEY) {
          // 如果沒有 VAPID 公鑰，先從後端獲取
          try {
            const response = await apiRequest('/api/push/vapid-public-key');
            const data = await response.json();
            if (data.publicKey) {
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(data.publicKey),
              });
            } else {
              throw new Error('無法獲取 VAPID 公鑰');
            }
          } catch (error) {
            throw new Error('無法獲取 VAPID 公鑰，請確認後端已配置');
          }
        } else {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }
      }

      // 將訂閱資訊發送到後端
      const subscriptionData = subscription.toJSON();
      await apiRequest('/api/push/subscribe', 'POST', {
        endpoint: subscriptionData.endpoint,
        keys: subscriptionData.keys,
      });

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        permission: 'granted',
        error: null,
      }));

      console.log('[Push] 訂閱成功');
      return true;
    } catch (error) {
      console.error('[Push] 訂閱失敗:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '訂閱失敗',
      }));
      return false;
    }
  }, [state.isSupported]);

  // 取消訂閱
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 通知後端取消訂閱
        await apiRequest('/api/push/unsubscribe', 'POST', {
          endpoint: subscription.endpoint,
        });

        // 取消本地訂閱
        await subscription.unsubscribe();
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
      }));

      console.log('[Push] 已取消訂閱');
      return true;
    } catch (error) {
      console.error('[Push] 取消訂閱失敗:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '取消訂閱失敗',
      }));
      return false;
    }
  }, [state.isSupported]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
  };
}
