# 智能多語言語音轉錄平台

一個基於 Web 的企業級語音轉錄解決方案，整合 Google Cloud Speech-to-Text Chirp 模型和 Gemini AI 智能分析功能。

## 核心功能

### 語音轉錄
- **高精度轉錄**：使用 Google Cloud Speech-to-Text Chirp 模型，支援繁體中文
- **長音檔支援**：支援 1.5-2 小時的長音檔批量處理
- **對話者識別**：自動識別並標記不同對話者（最多 6 人）
- **即時處理**：支援音頻上傳和實時轉錄進度追蹤
- **音頻可視化**：錄音時提供實時音量顯示

### AI 智能分析
- **文本清理**：使用 Gemini AI 自動清理和重組轉錄內容
- **智能摘要**：生成重點摘要和關鍵信息提取
- **對話者分析**：分析對話者角色和貢獻度
- **主題檢測**：自動識別討論主題和關鍵字
- **行動項目**：自動提取待辦事項

### 用戶管理系統
- **角色權限控制**：支援管理員和一般用戶角色
- **帳號申請審核**：完整的用戶註冊和審核流程
- **密碼安全管理**：加密存儲和重置機制

## 技術架構

### 前端技術
- **React 18** + **TypeScript**
- **Vite** 高效能建構工具
- **Tailwind CSS** + **Shadcn/UI**
- **TanStack Query** 資料狀態管理

### 後端技術
- **Node.js** + **Express**
- **TypeScript**
- **PostgreSQL** + **Drizzle ORM**

### 外部服務
- **Google Cloud Speech-to-Text**：Chirp 模型語音轉錄
- **Google Cloud Storage**：音檔暫存
- **Gemini AI**：智能內容分析
- **SendGrid**：郵件通知服務

---

## 部署指南

### GCP VM 自架規格（簡易測試）

| 元件 | 建議規格 | 說明 |
|------|---------|------|
| VM | e2-small | 0.5 vCPU, 2GB RAM |
| 作業系統 | Ubuntu 22.04 LTS | 免費 |
| 硬碟 | 20GB SSD | 標準永久磁碟 |
| 資料庫 | 同一 VM 安裝 PostgreSQL | 避免 Cloud SQL 費用 |
| Region | us-central1 (Iowa) | 價格最便宜 |

### 預估月費用

| 項目 | 規格 | 月費 (USD) |
|------|------|-----------|
| VM (e2-small) | 0.5 vCPU, 2GB | ~$12.23 |
| 硬碟 | 20GB SSD | ~$3.40 |
| Cloud Storage | 5GB（暫存音檔） | 免費額度內 |
| 網路出口流量 | < 1GB/月 | 免費額度內 |
| **小計** | | **~$15-16/月** |

### API 使用費（按實際使用）

| 服務 | 費用 |
|------|------|
| Speech-to-Text (Chirp) | $0.004/分鐘（批量模式） |
| Gemini Flash | 極低，幾乎免費 |

**範例**：一次 2 小時音檔 = 120 分鐘 × $0.004 = **$0.48**

---

## 快速開始

### 環境需求
- Node.js 18+
- PostgreSQL 14+
- Google Cloud 帳號（需開啟 Speech-to-Text API、Cloud Storage API）

### 安裝步驟

1. **安裝依賴**
```bash
npm install
```

2. **配置環境變數**（參考 `.env.example`）
```env
# Google Cloud 設定
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Gemini API
GEMINI_API_KEY=your-gemini-key

# 資料庫
DATABASE_URL=postgresql://username:password@localhost:5432/voicetextpro

# Session
SESSION_SECRET=your-random-session-secret
```

3. **資料庫初始化**
```bash
npm run db:push
```

4. **啟動開發伺服器**
```bash
npm run dev
```

---

## 專案結構

```
├── client/                 # 前端應用
│   ├── src/
│   │   ├── components/     # React 組件
│   │   ├── pages/          # 頁面組件
│   │   ├── hooks/          # 自定義 Hooks
│   │   └── lib/            # 工具函數
├── server/                 # 後端應用
│   ├── routes.ts           # API 路由
│   ├── auth.ts             # 身份驗證
│   ├── db.ts               # 資料庫連接
│   └── gemini-analysis.ts  # AI 分析 + 語音轉錄
├── shared/                 # 共享資源
│   └── schema.ts           # 資料庫架構
└── uploads/                # 文件存儲
```

---

## API 端點

### 身份驗證
```
POST /api/auth/login          # 用戶登入
POST /api/auth/logout         # 用戶登出
GET  /api/auth/me             # 獲取用戶信息
```

### 轉錄管理
```
GET    /api/transcriptions          # 轉錄列表
POST   /api/transcriptions          # 創建轉錄
GET    /api/transcriptions/:id      # 轉錄詳情
POST   /api/transcriptions/:id/analyze # AI 分析
```

### 管理員功能
```
GET    /api/admin/users             # 用戶管理
GET    /api/admin/applications      # 申請審核
GET    /api/admin/logs              # 系統日誌
```

---

## 文檔資源

- [使用者操作手冊](SYSTEM_USER_MANUAL.md)
- [API 文檔](API_DOCUMENTATION.md)
- [資料庫架構](DATABASE_SCHEMA.md)
- [變更記錄](CHANGELOG.md)

---

**智能多語言語音轉錄平台** - 提供專業級的語音轉錄和 AI 分析解決方案
