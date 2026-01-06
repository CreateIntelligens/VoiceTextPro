// Service Worker for VoiceTextPro
// 處理背景上傳和推送通知

const CACHE_NAME = 'voicetextpro-v1';

// 安裝事件
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 安裝中...');
  self.skipWaiting();
});

// 啟動事件
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 已啟動');
  event.waitUntil(clients.claim());
});

// 推送通知事件
self.addEventListener('push', (event) => {
  console.log('[SW] 收到推送通知');

  let data = {
    title: '語音轉錄完成',
    body: '您的音檔已完成轉錄，點擊查看結果。',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'transcription-complete',
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.warn('[SW] 無法解析推送資料:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'voicetextpro',
    vibrate: [100, 50, 100],
    data: data.data || { url: '/' },
    actions: [
      { action: 'view', title: '查看結果' },
      { action: 'close', title: '關閉' }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知點擊事件
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 通知被點擊');
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};

  if (action === 'close') {
    return;
  }

  // 預設行為或 'view' 動作
  const urlToOpen = notificationData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 如果已經有開啟的視窗，聚焦它
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // 否則開啟新視窗
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// 通知關閉事件
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] 通知被關閉');
});

// 背景同步事件 (用於離線上傳恢復)
self.addEventListener('sync', (event) => {
  console.log('[SW] 背景同步事件:', event.tag);

  if (event.tag === 'upload-audio') {
    event.waitUntil(handleBackgroundUpload());
  }
});

// 處理背景上傳
async function handleBackgroundUpload() {
  console.log('[SW] 處理背景上傳...');

  // 從 IndexedDB 獲取待上傳的檔案
  const pendingUploads = await getPendingUploads();

  for (const upload of pendingUploads) {
    try {
      const response = await fetch('/api/transcriptions/upload', {
        method: 'POST',
        body: upload.formData,
        headers: {
          'Authorization': `Bearer ${upload.token}`
        }
      });

      if (response.ok) {
        // 上傳成功，從待處理列表移除
        await removePendingUpload(upload.id);

        // 發送本地通知
        self.registration.showNotification('上傳完成', {
          body: `${upload.filename} 已開始轉錄`,
          icon: '/favicon.ico',
          tag: 'upload-complete'
        });
      }
    } catch (error) {
      console.error('[SW] 背景上傳失敗:', error);
    }
  }
}

// IndexedDB 操作 (簡化版)
async function getPendingUploads() {
  // 這裡簡化處理，實際應使用 IndexedDB
  return [];
}

async function removePendingUpload(id) {
  // 這裡簡化處理，實際應使用 IndexedDB
}

// 訊息事件 (與主頁面通訊)
self.addEventListener('message', (event) => {
  console.log('[SW] 收到訊息:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
