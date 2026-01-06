import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 註冊 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[App] Service Worker 註冊成功:', registration.scope);

      // 檢查更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[App] 新版 Service Worker 可用');
            }
          });
        }
      });
    } catch (error) {
      console.warn('[App] Service Worker 註冊失敗:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
