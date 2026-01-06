# VoiceTextPro API 使用指南

本文件詳細說明 VoiceTextPro 系統的 API 架構、使用方式及處理流程。

---

## 目錄

1. [系統架構概覽](#系統架構概覽)
2. [API 端點清單](#api-端點清單)
3. [認證機制](#認證機制)
4. [轉錄處理流程](#轉錄處理流程)
5. [外部 API 整合](#外部-api-整合)
6. [循序圖](#循序圖)

---

## 系統架構概覽

VoiceTextPro 是一個企業級語音轉錄系統，整合以下核心技術：

| 服務 | 用途 | 說明 |
|------|------|------|
| **Google Cloud Speech-to-Text** | 語音轉文字 | 使用 Chirp 3 模型，支援繁體中文 |
| **Google Cloud Storage (GCS)** | 音檔儲存 | 暫存音檔供 Speech-to-Text 處理 |
| **Gemini AI** | 智能分析 | 說話人識別、文字整理、內容分析 |

### 技術棧
- **後端**：Express.js + TypeScript
- **資料庫**：PostgreSQL + Drizzle ORM
- **前端**：React + Vite

---

## API 端點清單

### 認證 API (`/api/auth/*`)

| 方法 | 端點 | 說明 | 需認證 |
|------|------|------|--------|
| POST | `/api/auth/login` | 用戶登入 | 否 |
| POST | `/api/auth/logout` | 用戶登出 | 否 |
| POST | `/api/auth/register` | 用戶註冊 | 否 |
| POST | `/api/auth/forgot-password` | 忘記密碼 | 否 |
| POST | `/api/auth/change-password` | 修改密碼 | 是 |
| POST | `/api/auth/apply` | 申請帳號 | 否 |
| GET | `/api/auth/me` | 取得當前用戶資訊 | 是 |

### 轉錄 API (`/api/transcriptions/*`)

| 方法 | 端點 | 說明 | 需認證 |
|------|------|------|--------|
| POST | `/api/transcriptions/upload` | 上傳音檔 | 是 |
| POST | `/api/transcriptions/:id/start` | 開始轉錄 | 否 |
| GET | `/api/transcriptions/:id` | 取得轉錄記錄 | 否 |
| GET | `/api/transcriptions` | 取得所有轉錄記錄 | 是 |
| PATCH | `/api/transcriptions/:id` | 更新轉錄記錄 | 否 |
| DELETE | `/api/transcriptions/:id` | 刪除轉錄記錄 | 否 |
| POST | `/api/transcriptions/:id/cancel` | 取消轉錄 | 否 |
| GET | `/api/transcriptions/:id/download-audio` | 下載音檔 | 是 |

### AI 分析 API

| 方法 | 端點 | 說明 | 需認證 |
|------|------|------|--------|
| POST | `/api/transcriptions/:id/ai-analysis` | AI 智能分析 | 是 |
| POST | `/api/transcriptions/:id/ai-cleanup` | AI 逐字稿整理 | 是 |
| POST | `/api/transcriptions/:id/gemini-analysis` | Gemini 深度分析 | 是 |
| POST | `/api/transcriptions/:id/analyze` | 快速 AI 分析 | 否 |
| POST | `/api/transcriptions/:id/clean` | 逐字稿清理 | 否 |
| POST | `/api/transcriptions/:id/segment` | AI 語意分段 | 否 |
| PATCH | `/api/transcriptions/:id/speakers` | 更新講者標籤 | 是 |

### 推送通知 API (`/api/push/*`)

| 方法 | 端點 | 說明 | 需認證 |
|------|------|------|--------|
| GET | `/api/push/vapid-public-key` | 取得 VAPID 公鑰 | 否 |
| POST | `/api/push/subscribe` | 訂閱推送通知 | 否 |
| POST | `/api/push/unsubscribe` | 取消訂閱 | 否 |
| POST | `/api/push/test` | 測試推送 | 是 (管理員) |

### 管理員 API (`/api/admin/*`)

| 方法 | 端點 | 說明 | 需認證 |
|------|------|------|--------|
| GET | `/api/admin/users` | 取得所有用戶 | 管理員 |
| PATCH | `/api/admin/users/:id` | 更新用戶資訊 | 管理員 |
| POST | `/api/admin/create-user` | 創建用戶 | 管理員 |
| DELETE | `/api/admin/users/:id` | 刪除用戶 | 管理員 |
| GET | `/api/admin/applications` | 取得帳號申請 | 管理員 |
| POST | `/api/admin/applications/:id/approve` | 核准申請 | 管理員 |
| POST | `/api/admin/applications/:id/reject` | 拒絕申請 | 管理員 |
| GET | `/api/admin/transcriptions` | 取得所有轉錄 | 管理員 |
| DELETE | `/api/admin/transcriptions/:id` | 刪除轉錄 | 管理員 |
| GET | `/api/admin/logs` | 取得系統日誌 | 否 |

---

## 認證機制

### 登入流程

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**回應：**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

### 認證方式

系統支援兩種認證方式：

1. **Bearer Token**：在 Header 中加入 `Authorization: Bearer <token>`
2. **Cookie**：登入後自動設定 `auth_token` Cookie

---

## 轉錄處理流程

### 完整處理流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VoiceTextPro 轉錄流程                            │
└─────────────────────────────────────────────────────────────────────────┘

1. 用戶上傳音檔
       │
       ▼
2. 建立轉錄記錄 (status: pending)
       │
       ▼
3. 開始轉錄 (/api/transcriptions/:id/start)
       │
       ▼
4. 音檔前處理
   ├── 靜音裁切 (小於 50MB 的檔案)
   ├── 格式檢查 (MP3, WAV, M4A, FLAC, AAC, OGG, WEBM)
   └── 長度檢測 (超過 55 分鐘需分割)
       │
       ▼
5. 上傳至 Google Cloud Storage
       │
       ▼
6. 呼叫 Speech-to-Text V2 API (chirp_3 模型)
   ├── 語言: cmn-Hant-TW (繁體中文)
   ├── 自動偵測音檔格式
   └── 批次辨識 (BatchRecognize)
       │
       ▼
7. 處理辨識結果
   ├── 提取轉錄文字
   ├── 建立時間戳分段
   └── 預設講者標籤 (講者A)
       │
       ▼
8. 更新資料庫 (status: completed)
       │
       ▼
9. 發送推送通知
       │
       ▼
10. 清理暫存檔案 (GCS 和本地)
```

### 說話人識別流程

**重要：說話人識別由 Gemini AI 執行，而非 Speech-to-Text**

```
Speech-to-Text (chirp_3)     Gemini AI
     │                           │
     │ 1. 語音轉文字              │
     │ (不支援繁中 diarization)   │
     │                           │
     ▼                           │
   純文字結果                     │
     │                           │
     │  2. 用戶點擊「整理逐字稿」  │
     └─────────────────────────►│
                                 │
                                 ▼
                          3. 分析語氣、用詞
                             識別不同說話人
                                 │
                                 ▼
                          4. 分配講者標籤
                             (講者A, 講者B...)
                                 │
                                 ▼
                          5. 返回整理後的逐字稿
```

---

## 外部 API 整合

### Google Cloud Speech-to-Text V2

**配置位置：** `server/gemini-analysis.ts`

```typescript
// 初始化 V2 SpeechClient
this.speechClientV2 = new SpeechClientV2({
  apiEndpoint: "us-speech.googleapis.com",
});

// 請求配置
const request = {
  recognizer: `projects/${projectId}/locations/us/recognizers/_`,
  config: {
    autoDecodingConfig: {},           // 自動偵測音檔格式
    languageCodes: ["cmn-Hant-TW"],   // 繁體中文
    model: "chirp_3",                  // 使用 chirp_3 模型
    features: {},                      // 注意：繁中不支援 diarization
  },
  files: [{ uri: gcsUri }],
  recognitionOutputConfig: {
    inlineResponseConfig: {},
  },
};
```

**定價：**
- Speech-to-Text (Chirp): $0.004/分鐘（批量模式）
- 免費額度: 每月 60 分鐘

### Google Cloud Storage

**用途：** 暫存音檔供 Speech-to-Text 處理

```typescript
// 上傳音檔到 GCS
const gcsUri = await this.uploadToGCS(audioFilePath);
// 格式: gs://bucket-name/filename

// 處理完成後清理
await this.cleanupGCSFile(gcsUri);
```

### Gemini AI

**模型配置：**

| 用途 | 模型 | 說明 |
|------|------|------|
| 語音轉錄 | `gemini-3-flash-preview` | 支援最長 9.5 小時音檔 |
| AI 分析 | `gemini-2.0-flash` | 快速分析、說話人識別 |

**主要功能：**

1. **說話人識別** (`identifySpeakersWithGemini`)
   - 分析語氣、用詞、問答模式
   - 最多識別 6 位說話人
   - 自動分配講者標籤

2. **逐字稿整理** (`/api/transcriptions/:id/ai-cleanup`)
   - 修正語法錯誤和錯別字
   - 移除口語贅詞
   - 添加標點符號
   - 支援與會者名單對應

3. **AI 智能分析** (`/api/transcriptions/:id/ai-analysis`)
   - 內容摘要
   - 關鍵主題提取
   - 重點追蹤事項
   - 講者分析

---

## 循序圖

### 1. 音檔上傳與轉錄循序圖

```
┌────────┐          ┌────────┐          ┌─────────┐          ┌─────┐          ┌──────────────────┐
│ Client │          │ Server │          │   GCS   │          │ STT │          │    Database      │
└───┬────┘          └───┬────┘          └────┬────┘          └──┬──┘          └────────┬─────────┘
    │                   │                    │                  │                      │
    │ POST /upload      │                    │                  │                      │
    │ (audio file)      │                    │                  │                      │
    │──────────────────>│                    │                  │                      │
    │                   │                    │                  │                      │
    │                   │ INSERT transcription (status: pending)│                      │
    │                   │─────────────────────────────────────────────────────────────>│
    │                   │                    │                  │                      │
    │   201 Created     │                    │                  │                      │
    │<──────────────────│                    │                  │                      │
    │                   │                    │                  │                      │
    │ POST /start       │                    │                  │                      │
    │──────────────────>│                    │                  │                      │
    │                   │                    │                  │                      │
    │                   │ UPDATE status: processing             │                      │
    │                   │─────────────────────────────────────────────────────────────>│
    │                   │                    │                  │                      │
    │ 200 OK (async)    │                    │                  │                      │
    │<──────────────────│                    │                  │                      │
    │                   │                    │                  │                      │
    │                   │ Upload audio       │                  │                      │
    │                   │───────────────────>│                  │                      │
    │                   │                    │                  │                      │
    │                   │     gs:// URI      │                  │                      │
    │                   │<───────────────────│                  │                      │
    │                   │                    │                  │                      │
    │                   │ BatchRecognize (chirp_3)              │                      │
    │                   │──────────────────────────────────────>│                      │
    │                   │                    │                  │                      │
    │                   │ (等待處理中...)    │                  │                      │
    │                   │                    │                  │                      │
    │                   │     Transcription result              │                      │
    │                   │<──────────────────────────────────────│                      │
    │                   │                    │                  │                      │
    │                   │ UPDATE status: completed, transcriptText                     │
    │                   │─────────────────────────────────────────────────────────────>│
    │                   │                    │                  │                      │
    │                   │ Delete audio       │                  │                      │
    │                   │───────────────────>│                  │                      │
    │                   │                    │                  │                      │
    │ Push Notification │                    │                  │                      │
    │<──────────────────│                    │                  │                      │
    │                   │                    │                  │                      │
```

### 2. AI 逐字稿整理循序圖

```
┌────────┐          ┌────────┐          ┌──────────┐          ┌──────────────────┐
│ Client │          │ Server │          │ Gemini   │          │    Database      │
└───┬────┘          └───┬────┘          └────┬─────┘          └────────┬─────────┘
    │                   │                    │                         │
    │ POST /ai-cleanup  │                    │                         │
    │ {attendees: [...]}│                    │                         │
    │──────────────────>│                    │                         │
    │                   │                    │                         │
    │                   │ SELECT transcription                         │
    │                   │─────────────────────────────────────────────>│
    │                   │                    │                         │
    │                   │     transcription data                       │
    │                   │<─────────────────────────────────────────────│
    │                   │                    │                         │
    │                   │ 分段處理文本       │                         │
    │                   │ (每段 5000 字)     │                         │
    │                   │                    │                         │
    │                   │ Prompt: 說話者識別 + 文字整理                │
    │                   │───────────────────>│                         │
    │                   │                    │                         │
    │                   │ 整理後的逐字稿     │                         │
    │                   │ (姓名: 內容)       │                         │
    │                   │<───────────────────│                         │
    │                   │                    │                         │
    │                   │ UPDATE cleanedSegments, cleanedTranscriptText│
    │                   │─────────────────────────────────────────────>│
    │                   │                    │                         │
    │  200 OK           │                    │                         │
    │  {cleanedSegments,│                    │                         │
    │   speakers}       │                    │                         │
    │<──────────────────│                    │                         │
    │                   │                    │                         │
```

### 3. AI 智能分析循序圖

```
┌────────┐          ┌────────┐          ┌──────────┐          ┌──────────────────┐
│ Client │          │ Server │          │ Gemini   │          │    Database      │
└───┬────┘          └───┬────┘          └────┬─────┘          └────────┬─────────┘
    │                   │                    │                         │
    │ POST /ai-analysis │                    │                         │
    │──────────────────>│                    │                         │
    │                   │                    │                         │
    │                   │ SELECT transcription                         │
    │                   │─────────────────────────────────────────────>│
    │                   │                    │                         │
    │                   │ 優先使用 cleanedTranscriptText               │
    │                   │<─────────────────────────────────────────────│
    │                   │                    │                         │
    │                   │ Prompt: 全面 AI 智能分析                     │
    │                   │ - 內容摘要                                   │
    │                   │ - 關鍵主題                                   │
    │                   │ - 重點追蹤事項                               │
    │                   │ - 講者分析                                   │
    │                   │───────────────────>│                         │
    │                   │                    │                         │
    │                   │ JSON 分析結果      │                         │
    │                   │<───────────────────│                         │
    │                   │                    │                         │
    │                   │ UPDATE summary, keyTopics, actionItems, etc. │
    │                   │─────────────────────────────────────────────>│
    │                   │                    │                         │
    │  200 OK           │                    │                         │
    │  {analysis}       │                    │                         │
    │<──────────────────│                    │                         │
    │                   │                    │                         │
```

### 4. 長音檔分割處理循序圖

```
┌────────┐          ┌────────┐          ┌─────────┐          ┌─────┐
│ Client │          │ Server │          │   GCS   │          │ STT │
└───┬────┘          └───┬────┘          └────┬────┘          └──┬──┘
    │                   │                    │                  │
    │ POST /start       │                    │                  │
    │ (長音檔 > 55分鐘) │                    │                  │
    │──────────────────>│                    │                  │
    │                   │                    │                  │
    │                   │ ffprobe 取得時長   │                  │
    │                   │                    │                  │
    │                   │ 檢測: > 55 分鐘    │                  │
    │                   │ 需要分割處理       │                  │
    │                   │                    │                  │
    │                   │ ffmpeg 分割音檔    │                  │
    │                   │ (每段 50 分鐘)     │                  │
    │                   │                    │                  │
    │                   ├──────────────────────────────────────┤
    │                   │        處理第 1 段                    │
    │                   │ Upload segment 1   │                  │
    │                   │───────────────────>│                  │
    │                   │                    │                  │
    │                   │ BatchRecognize     │                  │
    │                   │──────────────────────────────────────>│
    │                   │                    │                  │
    │                   │ Result 1           │                  │
    │                   │<──────────────────────────────────────│
    │                   ├──────────────────────────────────────┤
    │                   │        處理第 2 段                    │
    │                   │ Upload segment 2   │                  │
    │                   │───────────────────>│                  │
    │                   │                    │                  │
    │                   │ BatchRecognize     │                  │
    │                   │──────────────────────────────────────>│
    │                   │                    │                  │
    │                   │ Result 2           │                  │
    │                   │<──────────────────────────────────────│
    │                   ├──────────────────────────────────────┤
    │                   │                    │                  │
    │                   │ 合併所有結果       │                  │
    │                   │ 調整時間戳         │                  │
    │                   │                    │                  │
    │ Push Notification │                    │                  │
    │<──────────────────│                    │                  │
    │                   │                    │                  │
```

---

## 資料結構

### Transcription 資料結構

```typescript
interface Transcription {
  id: number;
  userId: number;
  filename: string;
  originalName: string;
  displayName?: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
  progress: number;                    // 0-100
  googleSpeechOperationId?: string;

  // 轉錄結果
  transcriptText?: string;             // 原始轉錄文字
  cleanedTranscriptText?: string;      // AI 整理後的文字
  speakers?: Speaker[];                // 講者列表
  segments?: TranscriptSegment[];      // 原始分段
  cleanedSegments?: TranscriptSegment[]; // AI 整理後的分段

  confidence?: number;                 // 信心度 (0-1)
  duration?: number;                   // 音檔時長 (秒)
  wordCount?: number;                  // 字數

  // AI 分析結果
  summary?: string;                    // 內容摘要
  actionItems?: ActionItem[];          // 追蹤事項
  speakerAnalysis?: object;            // 講者分析
  keyTopics?: string[];                // 關鍵主題
  autoHighlights?: string[];           // 重要段落

  // 錄音資訊
  recordingType?: 'recorded' | 'uploaded';
  recordingDuration?: number;
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

interface Speaker {
  id: string;      // "A", "B", "C"...
  label: string;   // "講者A", "張先生"...
  color: string;   // "hsl(220, 70%, 50%)"
}

interface TranscriptSegment {
  text: string;
  speaker: string;
  start: number;   // 開始時間 (毫秒)
  end: number;     // 結束時間 (毫秒)
  confidence: number;
}

interface ActionItem {
  type: 'todo' | 'decision' | 'commitment' | 'deadline' | 'followup';
  content: string;
  assignee?: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}
```

---

## 錯誤處理

### 常見錯誤碼

| 狀態碼 | 說明 |
|--------|------|
| 400 | 請求格式錯誤（缺少必要參數、檔案格式不支援等）|
| 401 | 未授權（需要登入）|
| 403 | 權限不足 |
| 404 | 資源不存在 |
| 500 | 伺服器內部錯誤 |

### 錯誤回應格式

```json
{
  "message": "錯誤訊息說明"
}
```

---

## 使用限制

| 項目 | 一般用戶 | 管理員 |
|------|----------|--------|
| 檔案大小上限 | 500 MB | 無限制 |
| 支援格式 | MP3, WAV, M4A, AAC, FLAC, OGG, WEBM, 3GP, AMR | 同左 |
| 音檔時長上限 | 180 分鐘 | 無限制 |
| 每月免費額度 | 60 分鐘 (Speech-to-Text) | - |

---

## 環境變數

```env
# Google Cloud 設定
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=your-bucket-name

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# 資料庫
DATABASE_URL=postgresql://user:password@host:5432/database

# 推送通知 (可選)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

---

## 版本資訊

- **文件版本**：1.0.0
- **API 版本**：v1
- **最後更新**：2025-01-05
